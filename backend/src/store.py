"""DynamoDB access. One table: trees, their proofs, drives."""
import os
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

_table = None


def table():
    global _table
    if _table is None:
        _table = boto3.resource("dynamodb").Table(os.environ["TABLE"])
    return _table


def _plain(x):
    if isinstance(x, Decimal):
        return int(x) if x == x.to_integral_value() else float(x)
    if isinstance(x, dict):
        return {k: _plain(v) for k, v in x.items()}
    if isinstance(x, list):
        return [_plain(v) for v in x]
    return x


def _dec(x):
    if isinstance(x, float):
        return Decimal(str(x))
    if isinstance(x, dict):
        return {k: _dec(v) for k, v in x.items()}
    if isinstance(x, list):
        return [_dec(v) for v in x]
    return x


def get_tree(tree_id: str):
    r = table().get_item(Key={"pk": f"TREE#{tree_id}", "sk": "META"})
    return _plain(r.get("Item"))


def put_tree(meta: dict):
    table().put_item(Item=_dec({**meta, "pk": f"TREE#{meta['id']}", "sk": "META"}))


def update_tree(tree_id: str, **fields):
    names = {f"#{k}": k for k in fields}
    values = {f":{k}": _dec(v) for k, v in fields.items()}
    table().update_item(
        Key={"pk": f"TREE#{tree_id}", "sk": "META"},
        UpdateExpression="SET " + ", ".join(f"#{k} = :{k}" for k in fields),
        ExpressionAttributeNames=names, ExpressionAttributeValues=values,
        ConditionExpression="attribute_exists(pk)",
    )


def proofs(tree_id: str) -> list[dict]:
    r = table().query(KeyConditionExpression=Key("pk").eq(f"TREE#{tree_id}") & Key("sk").begins_with("PROOF#"))
    return _plain(r["Items"])


def put_proof(tree_id: str, received_at: str, record: dict):
    table().put_item(Item=_dec({**record, "pk": f"TREE#{tree_id}", "sk": f"PROOF#{received_at}"}))


def get_drive(drive_id: str):
    r = table().get_item(Key={"pk": f"DRIVE#{drive_id}", "sk": "META"})
    return _plain(r.get("Item"))


def put_drive(drive: dict):
    table().put_item(Item=_dec({**drive, "pk": f"DRIVE#{drive['id']}", "sk": "META"}))


def get_trees(tree_ids: list[str]) -> list[dict]:
    out = {}
    client = boto3.resource("dynamodb")
    name = os.environ["TABLE"]
    for i in range(0, len(tree_ids), 100):
        keys = [{"pk": f"TREE#{t}", "sk": "META"} for t in tree_ids[i:i + 100]]
        req = {name: {"Keys": keys}}
        while req:
            r = client.batch_get_item(RequestItems=req)
            for item in r["Responses"].get(name, []):
                out[item["id"]] = _plain(item)
            req = r.get("UnprocessedKeys")
    return [out[t] for t in tree_ids if t in out]


def all_proofs(tree_ids: list[str]) -> dict:
    return {t: proofs(t) for t in tree_ids}
