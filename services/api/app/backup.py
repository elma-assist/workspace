"""Back up immutable document objects without exposing storage credentials."""

import sys
import zipfile
from app.storage import client


def backup():
    s3 = client()
    with zipfile.ZipFile(
        sys.stdout.buffer, "w", compression=zipfile.ZIP_DEFLATED
    ) as archive:
        for page in s3.get_paginator("list_objects_v2").paginate(Bucket="elma"):
            for obj in page.get("Contents", []):
                response = s3.get_object(Bucket="elma", Key=obj["Key"])
                archive.writestr(obj["Key"], response["Body"].read())


if __name__ == "__main__":
    backup()
