"""Neemu's morning check, for every sapling, every day.

EventBridge starts a Step Functions run at 06:00 IST. The first step lists the
saplings; a Map step then runs one check per sapling, so one slow or failing tree
cannot hold up the rest. Each check stores what Neemu said that morning and has the
Hindi audio ready before anyone opens the app.
"""
import api
import push
import store
import weather
from common import now_iso


def list_trees(event, context):
    """-> {date, trees: [{treeId}]} for every sapling in every drive."""
    trees = []
    for d in store.query("DRIVES"):
        drive = store.get_drive(d["sk"])
        trees += [{"treeId": t} for t in (drive or {}).get("treeIds", [])]
    return {"date": weather.today_ist().isoformat(), "count": len(trees), "trees": trees}


def check_tree(event, context):
    """One sapling's morning: work out the ask, speak it, keep the record."""
    meta = store.get_tree(event["treeId"])
    if not meta:
        return {"treeId": event["treeId"], "skipped": "not found"}
    today = weather.today_ist()
    says = api.says_for(meta, today, False, audio=bool(meta.get("adopter")))
    store.put_item(f"TREE#{meta['id']}", f"SAID#{today.isoformat()}", {
        "ask": says["ask"], "litres": says["litres"], "textHi": says["textHi"], "textEn": says["textEn"],
        "spokenBy": says["spokenBy"], "heatDay": bool(says["heatwave"]), "at": now_iso(),
    })
    notified = 0
    if says["ask"] == "water" and meta.get("adopter"):
        notified = push.send(meta, f"{meta['name']} is thirsty", says["textHi"])
    return {"treeId": meta["id"], "ask": says["ask"], "litres": says["litres"], "adopted": bool(meta.get("adopter")),
            "notified": notified}


def summarise(event, context):
    """-> counts for the run, kept so the register can show when the morning check last ran."""
    results = [r for r in event.get("results", []) if isinstance(r, dict) and "ask" in r]
    out = {
        "date": event["date"], "checked": len(results), "failed": event["count"] - len(results),
        "askedForWater": sum(1 for r in results if r["ask"] == "water"),
        "toldToSkip": sum(1 for r in results if r["ask"] == "skip"),
        "litresAsked": round(sum(r["litres"] for r in results), 1),
        "phonesNotified": sum(r.get("notified", 0) for r in results),
        "at": now_iso(),
    }
    store.put_item("MORNING", event["date"], out)
    return out
