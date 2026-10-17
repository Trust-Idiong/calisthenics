from datetime import timedelta
from django.core.management import BaseCommand, call_command
from django.utils import timezone
from core.models import ThrottleBucket, EmailChallenge

class Command(BaseCommand):
    help = 'Remove expired sessions and old rate-limit metadata; retain accounts and progress.'
    def handle(self, *args, **options):
        count,_ = ThrottleBucket.objects.filter(window_start__lt=timezone.now()-timedelta(days=1)).delete()
        EmailChallenge.objects.filter(expires_at__lt=timezone.now()-timedelta(days=1)).delete()
        call_command('clearsessions')
        self.stdout.write(self.style.SUCCESS(f'Removed {count} expired rate-limit buckets.'))
