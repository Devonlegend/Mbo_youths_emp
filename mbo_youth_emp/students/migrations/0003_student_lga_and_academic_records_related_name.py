import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0002_student_passport_student_state_of_origin'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='lga',
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AlterField(
            model_name='academicrecord',
            name='student',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='academic_records',
                to='students.student',
            ),
        ),
        migrations.AlterField(
            model_name='academicrecord',
            name='admission_year',
            field=models.IntegerField(blank=True, null=True),
        ),
    ]
