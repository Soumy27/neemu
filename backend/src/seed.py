"""The example plantation drive: 40 saplings around DTU Gate 3.

The saplings, their adopters and their past care are illustrative. Each sapling has a
care profile, and the water balance runs that profile against real weather, so the
register's statuses are computed, not typed in.

Profile: the adopter waters once an ask has gone unanswered for `delay` days, and has
done nothing at all in the last `stopped` days (None = still watering).
"""
import store

DRIVE_ID = "dtu-eco-2026"
PLANTED_ON = "2026-08-14"
BASIN_M2 = 0.5

KINDS = [
    ("Neemu", "नीमू", "Neem (Azadirachta indica)"),
    ("Jamun", "जामुन", "Jamun (Syzygium cumini)"),
    ("Peepu", "पीपू", "Peepal (Ficus religiosa)"),
    ("Amla", "आँवला", "Amla (Phyllanthus emblica)"),
    ("Arjun", "अर्जुन", "Arjun (Terminalia arjuna)"),
]
ADOPTERS = ["riya", "kabir", "ananya", "dev", "meher", "zoya", "arnav"]

PROFILES = [
    {"delay": 0, "stopped": None},
    {"delay": 0, "stopped": None},
    {"delay": 1, "stopped": None},
    {"delay": 0, "stopped": 2},
    {"delay": 2, "stopped": None},
    {"delay": 0, "stopped": 5},
    {"delay": 1, "stopped": 9},
    {"delay": 0, "stopped": 9999},
]

# The sapling the adopter screen opens. Nobody has adopted it yet.
DEMO_TREE = "dtu-gate3-017"
DEMO_PROFILE = {"delay": 2, "stopped": 3}


def tree_id(i: int) -> str:
    return f"dtu-gate3-{i + 1:03d}"


def trees() -> list[dict]:
    out = []
    for i in range(40):
        name, name_hi, species = KINDS[0] if tree_id(i) == DEMO_TREE else KINDS[i % len(KINDS)]
        tid = tree_id(i)
        demo = tid == DEMO_TREE
        profile = DEMO_PROFILE if demo else PROFILES[i % len(PROFILES)]
        abandoned = profile["stopped"] == 9999 and i % 16 == 7
        out.append({
            "id": tid,
            "name": name,
            "nameHi": name_hi,
            "species": species,
            "plantedOn": PLANTED_ON,
            "driveId": DRIVE_ID,
            "location": {
                "lat": round(28.7495 + (i % 8) * 0.00015 + (((i * 37) % 11) - 5) * 0.00002, 6),
                "lng": round(77.1165 + (i // 8) * 0.0002 + (((i * 53) % 13) - 6) * 0.00002, 6),
                "label": "DTU, Gate 3, Delhi",
                "spot": "Gate 3",
                "spotHi": "गेट 3",
            },
            "basinM2": BASIN_M2,
            "adopter": None if demo or abandoned else {"handle": ADOPTERS[i % len(ADOPTERS)]},
            "adoptedOn": None,          # set when a real person adopts through the API
            "profile": profile,
            "example": True,
        })
    return out


def run() -> dict:
    ts = trees()
    for t in ts:
        store.put_tree(t)
    store.put_drive({
        "id": DRIVE_ID,
        "name": "DTU Eco Club drive, Aug 2026",
        "organiser": "DTU Eco Club",
        "treeIds": [t["id"] for t in ts],
    })
    return {"drive": DRIVE_ID, "trees": len(ts)}


def handler(event, context):
    return run()
