# Generated for scheme-by-scheme publish flow

import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('applications', '0001_initial'),
        ('schemes', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PendingApplicationNotification',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('application_id', models.UUIDField(db_index=True)),
                ('notification_type', models.CharField(choices=[('approved', 'Approved')], max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('scheme', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pending_notifications', to='schemes.scholarshipscheme')),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='pendingapplicationnotification',
            index=models.Index(fields=['scheme', 'sent_at'], name='applications_scheme_sent_idx'),
        ),
    ]
