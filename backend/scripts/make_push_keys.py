"""Create the Web Push key pair and put it in SSM Parameter Store. Run once per AWS account.

    uv run --with cryptography python backend/scripts/make_push_keys.py

The private key goes straight to Parameter Store as a SecureString. It is never printed
or written to disk. Running it again does nothing if the keys are already there.
"""
import base64
import subprocess

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def ssm(*args):
    return subprocess.run(["aws", "ssm", *args], capture_output=True, text=True)


if ssm("get-parameter", "--name", "/neemu/vapid-public").returncode == 0:
    print("Keys already exist in Parameter Store. Nothing to do.")
    raise SystemExit

key = ec.generate_private_key(ec.SECP256R1())
b64 = lambda raw: base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
private = b64(key.private_numbers().private_value.to_bytes(32, "big"))
public = b64(key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))

for name, kind, value in (("/neemu/vapid-private", "SecureString", private), ("/neemu/vapid-public", "String", public)):
    done = ssm("put-parameter", "--name", name, "--type", kind, "--value", value)
    if done.returncode != 0:
        raise SystemExit(f"Could not write {name}: {done.stderr.strip()}")
print("Created /neemu/vapid-private and /neemu/vapid-public.")
