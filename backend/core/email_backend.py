"""Brevo transactional delivery. Private credentials stay on the server."""
import json
from html import escape
from urllib.request import Request, HTTPRedirectHandler, build_opener
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

class BrevoDeliveryError(Exception):
    """Deliberately excludes provider errors, recipients, credentials and links."""

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # An API key must never follow a provider redirect to another endpoint.
        return None

class BrevoEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        accepted = 0
        for message in email_messages:
            if not message.recipients():
                continue
            try:
                if not settings.BREVO_API_KEY or not settings.BREVO_SENDER_EMAIL:
                    raise BrevoDeliveryError()
                # Application emails intentionally have no campaign/list IDs,
                # tracking flags or unrelated contact-management side effects.
                body = {
                    'sender': {'email': settings.BREVO_SENDER_EMAIL, 'name': settings.BREVO_SENDER_NAME},
                    'to': [{'email': address} for address in message.to],
                    'subject': message.subject,
                    'textContent': message.body,
                    'htmlContent': '<html><body><p>' + escape(message.body).replace('\n', '<br>') + '</p></body></html>',
                }
                if message.cc or message.bcc or not message.to:
                    raise BrevoDeliveryError()
                request = Request(BREVO_ENDPOINT, data=json.dumps(body).encode('utf-8'), method='POST',
                    headers={'api-key': settings.BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'})
                with build_opener(NoRedirect()).open(request, timeout=settings.EMAIL_TIMEOUT) as response:
                    if response.status != 201:
                        raise BrevoDeliveryError()
                    raw = response.read(65537)
                    if len(raw) > 65536:
                        raise BrevoDeliveryError()
                    result = json.loads(raw)
                    if not isinstance(result, dict) or not isinstance(result.get('messageId'), str) or not result['messageId']:
                        raise BrevoDeliveryError()
                # Brevo accepted the message. This does not establish delivery.
                accepted += 1
            except Exception:
                if not self.fail_silently:
                    raise BrevoDeliveryError('Transactional email could not be accepted.') from None
        return accepted
