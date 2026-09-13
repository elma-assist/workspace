import boto3
from botocore.config import Config

from app.settings import settings


def client(public: bool = False):
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_public_endpoint if public else settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name="us-east-1",
        config=Config(
            connect_timeout=5,
            read_timeout=20,
            retries={"max_attempts": 2},
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
    )


def put_text(key: str, text: str) -> None:
    s3 = client()
    try:
        s3.head_bucket(Bucket="elma")
    except s3.exceptions.ClientError:
        s3.create_bucket(Bucket="elma")
    s3.put_object(
        Bucket="elma",
        Key=key,
        Body=text.encode(),
        ContentType="text/plain; charset=utf-8",
    )


def download_url(key: str) -> str:
    return client(True).generate_presigned_url(
        "get_object", Params={"Bucket": "elma", "Key": key}, ExpiresIn=300
    )


def delete_objects(keys: list[str]) -> None:
    if not keys:
        return
    s3 = client()
    for start in range(0, len(keys), 1000):
        s3.delete_objects(
            Bucket="elma",
            Delete={
                "Objects": [{"Key": key} for key in keys[start : start + 1000]],
                "Quiet": True,
            },
        )
