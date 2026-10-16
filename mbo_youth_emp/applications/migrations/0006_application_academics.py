# Apply-time academics: snapshot tenure fields on the unified Application.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('applications', '0005_alter_application_updated_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='application',
            name='faculty',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='application',
            name='programme_type',
            field=models.CharField(blank=True, default='', max_length=30),
        ),
        migrations.AddField(
            model_name='application',
            name='programme_duration_years',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='application',
            name='entry_level',
            field=models.IntegerField(blank=True, null=True),
        ),
    ]
