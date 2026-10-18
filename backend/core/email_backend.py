"""Mailgun transactional delivery. Credentials and message links stay server-side."""
import base64
import json
import re
import secrets
from email.utils import formataddr
from html import escape
from urllib.request import Request, HTTPRedirectHandler, build_opener
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail.backends.base import BaseEmailBackend
from django.core.validators import validate_email

API_ORIGINS = {'https://api.mailgun.net', 'https://api.eu.mailgun.net'}
DOMAIN_RE = re.compile(r'(?=.{1,253}\Z)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?\Z')

class MailgunDeliveryError(Exception):
    """Deliberately excludes provider errors, recipients, credentials and links."""

def mailgun_config(recipients=()):
    """Validate before account creation and again immediately before transport."""
    domain=settings.MAILGUN_DOMAIN
    base=settings.MAILGUN_API_BASE_URL
    key=settings.MAILGUN_API_KEY
    sender=settings.MAILGUN_SENDER_EMAIL
    name=settings.MAILGUN_SENDER_NAME
    if (not isinstance(domain,str) or not DOMAIN_RE.fullmatch(domain) or not isinstance(base,str) or base not in API_ORIGINS or
            not isinstance(key,str) or not key or len(key)>512 or re.search(r'[\x00-\x1f\x7f]',key) or
            not isinstance(sender,str) or not isinstance(name,str) or len(name)>200 or re.search(r'[\x00-\x1f\x7f]',name)):
        raise MailgunDeliveryError('Account email is not configured.')
    try:
        validate_email(sender)
        for recipient in recipients:
            if not isinstance(recipient,str): raise ValidationError('Invalid recipient.')
            validate_email(recipient)
    except ValidationError:
        raise MailgunDeliveryError('Account email is not configured.') from None
    # This local list is an additional gate, not Mailgun authorization.
    if domain.endswith('.mailgun.org'):
        allowed=settings.MAILGUN_SANDBOX_RECIPIENTS
        if not isinstance(allowed,(tuple,list)) or any(not isinstance(address,str) for address in allowed) or not 1<=len(set(allowed))<=5:
            raise MailgunDeliveryError('Account email is not configured.')
        try:
            for address in allowed:
                if address!=address.strip().lower(): raise ValidationError('Invalid recipient.')
                validate_email(address)
        except ValidationError:
            raise MailgunDeliveryError('Account email is not configured.') from None
        if not recipients or any(address.lower() not in allowed for address in recipients):
            raise MailgunDeliveryError('Account email is not available for this request.')
    return base+'/v3/'+domain+'/messages',formataddr((name,sender))

def multipart_form(fields):
    boundary='form-mailgun-'+secrets.token_hex(16)
    body=bytearray()
    for name,value in fields:
        body.extend(('--'+boundary+'\r\nContent-Disposition: form-data; name="'+name+'"\r\n'
            'Content-Type: text/plain; charset=utf-8\r\n\r\n'+value+'\r\n').encode('utf-8'))
    body.extend(('--'+boundary+'--\r\n').encode('ascii'))
    return bytes(body),'multipart/form-data; boundary='+boundary

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        # A private Authorization header must never follow a redirect.
        return None

class MailgunEmailBackend(BaseEmailBackend):
    def send_messages(self,email_messages):
        accepted=0
        for message in email_messages:
            if not message.recipients(): continue
            try:
                if message.cc or message.bcc or len(message.to)!=1 or message.attachments:
                    raise MailgunDeliveryError()
                endpoint,sender=mailgun_config(message.to)
                body,content_type=multipart_form([
                    ('from',sender),('to',message.to[0]),('subject',message.subject),('text',message.body),
                    ('html','<html><body><p>'+escape(message.body).replace('\n','<br>')+'</p></body></html>'),
                    ('o:tracking','no'),('o:tracking-clicks','no'),('o:tracking-opens','no'),
                    ('o:require-tls','yes'),('o:skip-verification','no'),
                ])
                credentials=base64.b64encode(('api:'+settings.MAILGUN_API_KEY).encode('utf-8')).decode('ascii')
                request=Request(endpoint,data=body,method='POST',headers={
                    'Authorization':'Basic '+credentials,'Content-Type':content_type,'Accept':'application/json'})
                with build_opener(NoRedirect()).open(request,timeout=settings.EMAIL_TIMEOUT) as response:
                    if response.status!=200: raise MailgunDeliveryError()
                    raw=response.read(65537)
                    if len(raw)>65536: raise MailgunDeliveryError()
                    result=json.loads(raw)
                    if (not isinstance(result,dict) or not isinstance(result.get('id'),str) or not result['id'] or
                            not isinstance(result.get('message'),str) or not result['message']):
                        raise MailgunDeliveryError()
                # Queued/accepted by the provider is not proof of delivery.
                accepted+=1
            except Exception:
                if not self.fail_silently:
                    raise MailgunDeliveryError('Transactional email could not be accepted.') from None
        return accepted
