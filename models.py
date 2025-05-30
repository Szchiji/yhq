class UserStatus(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, unique=True, nullable=False)
    username = db.Column(db.String(255))  # 确保这一行存在
    status = db.Column(db.String(50))
    last_publish = db.Column(db.DateTime)