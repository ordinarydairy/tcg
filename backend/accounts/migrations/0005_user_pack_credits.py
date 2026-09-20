from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_user_tag'),
        ('accounts', '0004_alter_user_profile_photo'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='last_pack_pull_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='pack_credits',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
