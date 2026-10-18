import base64
import json
from email.parser import BytesParser
from email.policy import default
from unittest.mock import MagicMock, patch
from django.core.mail import EmailMessage
from django.test import SimpleTestCase, override_settings
from .email_backend import MailgunEmailBackend, MailgunDeliveryError, NoRedirect

def multipart_fields(request):
    header=b'Content-Type: '+request.get_header('Content-type').encode('ascii')+b'\r\nMIME-Version: 1.0\r\n\r\n'
    parsed=BytesParser(policy=default).parsebytes(header+request.data)
    return {part.get_param('name',header='content-disposition'):part.get_payload(decode=True).decode('utf-8') for part in parsed.iter_parts()}

MAIL_SETTINGS={
    'MAILGUN_API_KEY':'DUMMY-TEST-KEY-NOT-REAL',
    'MAILGUN_DOMAIN':'mg.example.test',
    'MAILGUN_API_BASE_URL':'https://api.mailgun.net',
    'MAILGUN_SENDER_EMAIL':'verified@mg.example.test',
    'MAILGUN_SENDER_NAME':'FORM',
    'MAILGUN_SANDBOX_RECIPIENTS':(),
    'EMAIL_TIMEOUT':10,
}

@override_settings(**MAIL_SETTINGS)
class MailgunBackendTests(SimpleTestCase):
    def response(self,status=200,body=b'{"id":"test-accepted-message","message":"Queued. Thank you."}'):
        response=MagicMock();response.status=status;response.read.return_value=body
        response.__enter__.return_value=response
        return response

    def message(self):
        return EmailMessage('Confirm sign-in','Private link: <token>\nNext line','ignored@example.test',['athlete@example.test'])

    def test_https_multipart_payload_private_basic_auth_and_tracking_disabled(self):
        with patch('core.email_backend.build_opener') as factory:
            factory.return_value.open.return_value=self.response()
            count=MailgunEmailBackend().send_messages([self.message()])
        self.assertEqual(count,1)
        request=factory.return_value.open.call_args.args[0]
        self.assertEqual(request.full_url,'https://api.mailgun.net/v3/mg.example.test/messages')
        self.assertEqual(request.method,'POST')
        auth=request.get_header('Authorization')
        self.assertTrue(auth.startswith('Basic '))
        self.assertEqual(base64.b64decode(auth.split(' ',1)[1]).decode(),'api:DUMMY-TEST-KEY-NOT-REAL')
        self.assertEqual(factory.return_value.open.call_args.kwargs['timeout'],10)
        self.assertTrue(request.get_header('Content-type').startswith('multipart/form-data; boundary='))
        body=multipart_fields(request)
        self.assertEqual(body['from'],'FORM <verified@mg.example.test>')
        self.assertEqual(body['to'],'athlete@example.test')
        self.assertEqual(body['text'],'Private link: <token>\nNext line')
        self.assertIn('&lt;token&gt;',body['html'])
        self.assertNotIn('DUMMY-TEST-KEY-NOT-REAL',json.dumps(body))
        self.assertEqual({key:body[key] for key in ['o:tracking','o:tracking-clicks','o:tracking-opens']},
            {'o:tracking':'no','o:tracking-clicks':'no','o:tracking-opens':'no'})
        self.assertEqual(body['o:require-tls'],'yes')
        self.assertEqual(body['o:skip-verification'],'no')
        self.assertEqual(set(body),{'from','to','subject','text','html','o:tracking','o:tracking-clicks','o:tracking-opens','o:require-tls','o:skip-verification'})

    @override_settings(MAILGUN_API_BASE_URL='https://api.eu.mailgun.net')
    def test_european_region_is_supported(self):
        with patch('core.email_backend.build_opener') as factory:
            factory.return_value.open.return_value=self.response()
            self.assertEqual(MailgunEmailBackend().send_messages([self.message()]),1)
        self.assertEqual(factory.return_value.open.call_args.args[0].full_url,'https://api.eu.mailgun.net/v3/mg.example.test/messages')

    def test_rejected_timeout_and_malformed_responses_fail_without_provider_details(self):
        responses=[self.response(201),self.response(400),self.response(401),self.response(429),self.response(500),
            self.response(body=b'not json'),self.response(body=b'{}'),self.response(body=b'{"id":null}'),self.response(body=b'{"id":"test"}'),
            self.response(body=b'x'*65537),RuntimeError('PRIVATE-PROVIDER-DIAGNOSTIC')]
        for response in responses:
            with self.subTest(response=response),patch('core.email_backend.build_opener') as factory:
                if isinstance(response,Exception): factory.return_value.open.side_effect=response
                else: factory.return_value.open.return_value=response
                with self.assertRaises(MailgunDeliveryError) as error:
                    MailgunEmailBackend().send_messages([self.message()])
                self.assertNotIn('PRIVATE',str(error.exception))
                self.assertNotIn('token',str(error.exception))

    @override_settings(MAILGUN_API_KEY='')
    def test_missing_private_configuration_never_opens_network(self):
        with patch('core.email_backend.build_opener') as factory:
            with self.assertRaises(MailgunDeliveryError):
                MailgunEmailBackend().send_messages([self.message()])
        factory.assert_not_called()

    def test_untrusted_origins_and_malformed_domains_never_open_network(self):
        configurations=[{'MAILGUN_API_BASE_URL':value} for value in [
            'http://api.mailgun.net','https://api.mailgun.net.evil.test','https://api.mailgun.net@evil.test',
            'https://api.mailgun.net/path','https://api.mailgun.net?key=test','https://api.mailgun.net#fragment',
            'https://127.0.0.1',[],None]]
        configurations += [{'MAILGUN_DOMAIN':value} for value in [
            'mg.example.test/../../x','mg.example.test?x','mg.example.test#x','https://mg.example.test',
            'mg@example.test','-invalid.example.test','invalid-.example.test','x'*64+'.example.test',[],None]]
        for values in configurations:
            with self.subTest(values=values),override_settings(**values),patch('core.email_backend.build_opener') as factory:
                with self.assertRaises(MailgunDeliveryError): MailgunEmailBackend().send_messages([self.message()])
                factory.assert_not_called()

    @override_settings(MAILGUN_DOMAIN='sandbox-example.mailgun.org',MAILGUN_SANDBOX_RECIPIENTS=('athlete@example.test',))
    def test_sandbox_requires_explicit_valid_limited_recipient_allowlist(self):
        with patch('core.email_backend.build_opener') as factory:
            factory.return_value.open.return_value=self.response()
            self.assertEqual(MailgunEmailBackend().send_messages([self.message()]),1)
        bad_lists=[(),('another@example.test',),('ATHLETE@example.test',),('bad-address',),([],),tuple('person'+str(i)+'@example.test' for i in range(6))]
        for allowed in bad_lists:
            with self.subTest(allowed=allowed),override_settings(MAILGUN_SANDBOX_RECIPIENTS=allowed),patch('core.email_backend.build_opener') as factory:
                with self.assertRaises(MailgunDeliveryError): MailgunEmailBackend().send_messages([self.message()])
                factory.assert_not_called()

    def test_invalid_sender_recipient_and_unexpected_message_features_are_rejected(self):
        for values in [{'MAILGUN_SENDER_EMAIL':'invalid-address'},{'MAILGUN_SENDER_NAME':'FORM\r\nInjected: yes'},{'MAILGUN_SENDER_NAME':'FORM\x00'}]:
            with self.subTest(values=values),override_settings(**values),patch('core.email_backend.build_opener') as factory:
                with self.assertRaises(MailgunDeliveryError): MailgunEmailBackend().send_messages([self.message()])
                factory.assert_not_called()
        invalid=EmailMessage('Subject','body','ignored@example.test',['bad-address'])
        cc=EmailMessage('Subject','body','ignored@example.test',['athlete@example.test'],cc=['another@example.test'])
        attachment=self.message();attachment.attach('not-supported.txt','data','text/plain')
        for message in [invalid,cc,attachment]:
            with self.subTest(message=message),patch('core.email_backend.build_opener') as factory:
                with self.assertRaises(MailgunDeliveryError): MailgunEmailBackend().send_messages([message])
                factory.assert_not_called()

    def test_silent_failure_and_redirect_are_blocked(self):
        with patch('core.email_backend.build_opener') as factory:
            factory.return_value.open.side_effect=TimeoutError('private details')
            self.assertEqual(MailgunEmailBackend(fail_silently=True).send_messages([self.message()]),0)
        self.assertIsNone(NoRedirect().redirect_request(None,None,302,'redirect',{},'https://another.example.test'))
