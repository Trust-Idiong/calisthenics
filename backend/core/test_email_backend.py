import json
from unittest.mock import MagicMock, patch
from django.core.mail import EmailMessage
from django.test import SimpleTestCase, override_settings
from .email_backend import BrevoEmailBackend, BrevoDeliveryError, BREVO_ENDPOINT, NoRedirect

@override_settings(BREVO_API_KEY='PRIVATE-TEST-KEY',BREVO_SENDER_EMAIL='verified@example.test',BREVO_SENDER_NAME='FORM',EMAIL_TIMEOUT=10)
class BrevoBackendTests(SimpleTestCase):
    def response(self,status=201,body=b'{"messageId":"test-accepted-message"}'):
        response=MagicMock();response.status=status;response.read.return_value=body
        response.__enter__.return_value=response
        return response

    def test_https_transactional_payload_and_private_header(self):
        with patch('core.email_backend.build_opener') as factory:
            factory.return_value.open.return_value=self.response()
            count=BrevoEmailBackend().send_messages([EmailMessage('Confirm sign-in','Private link: <token>','ignored@example.test',['athlete@example.test'])])
        self.assertEqual(count,1)
        request=factory.return_value.open.call_args.args[0]
        self.assertEqual(request.full_url,BREVO_ENDPOINT)
        self.assertEqual(request.method,'POST')
        self.assertEqual(request.get_header('Api-key'),'PRIVATE-TEST-KEY')
        self.assertEqual(factory.return_value.open.call_args.kwargs['timeout'],10)
        body=json.loads(request.data)
        self.assertEqual(body['sender'],{'email':'verified@example.test','name':'FORM'})
        self.assertEqual(body['to'],[{'email':'athlete@example.test'}])
        self.assertIn('&lt;token&gt;',body['htmlContent'])
        self.assertNotIn('PRIVATE-TEST-KEY',json.dumps(body))
        self.assertEqual(set(body),{'sender','to','subject','textContent','htmlContent'})

    def test_rejected_timeout_and_malformed_responses_fail_without_provider_details(self):
        for response in [self.response(400),self.response(200),self.response(body=b'not json'),self.response(body=b'{}'),self.response(body=b'x'*65537),RuntimeError('PRIVATE-PROVIDER-DIAGNOSTIC')]:
            with self.subTest(response=response),patch('core.email_backend.build_opener') as factory:
                if isinstance(response,Exception): factory.return_value.open.side_effect=response
                else: factory.return_value.open.return_value=response
                with self.assertRaises(BrevoDeliveryError) as error:
                    BrevoEmailBackend().send_messages([EmailMessage('Subject','token','from@example.test',['to@example.test'])])
                self.assertNotIn('PRIVATE',str(error.exception))
                self.assertNotIn('token',str(error.exception))

    @override_settings(BREVO_API_KEY='')
    def test_missing_private_configuration_never_opens_network(self):
        with patch('core.email_backend.build_opener') as factory:
            with self.assertRaises(BrevoDeliveryError):
                BrevoEmailBackend().send_messages([EmailMessage('Subject','body','from@example.test',['to@example.test'])])
        factory.assert_not_called()

    def test_silent_failure_and_redirect_are_blocked(self):
        with patch('core.email_backend.build_opener') as factory:
            factory.return_value.open.side_effect=TimeoutError('private details')
            self.assertEqual(BrevoEmailBackend(fail_silently=True).send_messages([EmailMessage('Subject','body','from@example.test',['to@example.test'])]),0)
        self.assertIsNone(NoRedirect().redirect_request(None,None,302,'redirect',{},'https://another.example.test'))
