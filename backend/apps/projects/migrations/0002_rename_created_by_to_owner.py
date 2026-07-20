from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="project",
            old_name="created_by",
            new_name="owner",
        ),
    ]