import os
import shutil
import schedule
import time
from datetime import datetime
from cryptography.fernet import Fernet

class BackupService:
    def __init__(self, source_dir, backup_dir, encryption_key=None):
        self.source_dir = source_dir
        self.backup_dir = backup_dir
        self.encryption_key = encryption_key
        self.fernet = Fernet(encryption_key) if encryption_key else None

    def schedule_backup(self, interval):
        schedule.every(interval).minutes.do(self.perform_backup)

    def perform_backup(self):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = os.path.join(self.backup_dir, f'backup_{timestamp}.zip')
        shutil.make_archive(backup_file[:-4], 'zip', self.source_dir)
        if self.encryption_key:
            self.encrypt_backup(backup_file)
        print(f'Backup performed: {backup_file}')

    def encrypt_backup(self, backup_file):
        with open(backup_file, 'rb') as f:
            data = f.read()
        encrypted_data = self.fernet.encrypt(data)
        with open(backup_file, 'wb') as f:
            f.write(encrypted_data)

    def restore_backup(self, backup_file):
        if self.encryption_key:
            self.decrypt_backup(backup_file)
        shutil.unpack_archive(backup_file, self.source_dir)
        print(f'Restored backup from: {backup_file}')

    def decrypt_backup(self, backup_file):
        with open(backup_file, 'rb') as f:
            encrypted_data = f.read()
        decrypted_data = self.fernet.decrypt(encrypted_data)
        with open(backup_file, 'wb') as f:
            f.write(decrypted_data)

    def run_scheduler(self):
        while True:
            schedule.run_pending()
            time.sleep(1)