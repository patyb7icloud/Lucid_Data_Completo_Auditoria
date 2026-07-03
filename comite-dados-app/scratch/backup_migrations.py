import os
import shutil

drizzle_dir = 'drizzle'
backup_dir = 'drizzle_backup'

# Create backup directory
if not os.path.exists(backup_dir):
    os.makedirs(backup_dir)

# Backup and remove SQL files and meta folder
for fname in os.listdir(drizzle_dir):
    fpath = os.path.join(drizzle_dir, fname)
    if fname.endswith('.sql'):
        shutil.copy(fpath, os.path.join(backup_dir, fname))
        os.remove(fpath)
        print(f"Backed up and removed: {fname}")
    elif fname == 'meta' and os.path.isdir(fpath):
        shutil.copytree(fpath, os.path.join(backup_dir, 'meta'), dirs_exist_ok=True)
        shutil.rmtree(fpath)
        print("Backed up and removed meta directory")
