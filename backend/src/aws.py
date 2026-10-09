"""Shared AWS clients."""
import os

import boto3
from botocore.config import Config

_clients: dict = {}


def s3():
    """S3 on the regional endpoint with SigV4, so presigned links work without a redirect."""
    if "s3" not in _clients:
        region = os.environ.get("AWS_REGION", "us-west-2")
        _clients["s3"] = boto3.client(
            "s3", region_name=region, endpoint_url=f"https://s3.{region}.amazonaws.com",
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}))
    return _clients["s3"]


def client(name: str):
    if name not in _clients:
        _clients[name] = boto3.client(name)
    return _clients[name]
