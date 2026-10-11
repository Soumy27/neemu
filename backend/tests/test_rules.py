"""The rules that decide a proof, a review and a distance, checked without AWS."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
os.environ.setdefault("AWS_DEFAULT_REGION", "us-west-2")

import common
import proofs


def test_distance_between_two_points_twenty_metres_apart():
    d = common.distance_m(26.2183, 78.1828, 26.2183 + 0.00018, 78.1828)
    assert 19.5 < d < 20.5


def test_standing_at_the_sapling_with_a_good_fix_passes():
    assert proofs.position_problem(4.0, 8.0) is None


def test_the_gate_allows_for_the_phones_own_accuracy():
    assert proofs.position_problem(14.9, 5.0) is None       # inside the 15 m floor
    assert proofs.position_problem(28.0, 30.0) is None      # inside the phone's stated accuracy
    assert "28 m from this sapling" in proofs.position_problem(28.0, 20.0)


def test_a_vague_fix_proves_nothing_however_close():
    assert "only good to 80 m" in proofs.position_problem(0.0, 80.0)
    assert proofs.position_problem(0.0, 50.0) is None       # 50 m is the limit, inclusive


def test_no_position_is_refused():
    assert "did not share its position" in proofs.position_problem(None, None)
    assert "did not share its position" in proofs.position_problem(3.0, None)


def test_first_proof_and_vague_fixes_always_go_to_a_person():
    assert proofs.needs_review("abc", first=True, accuracy_m=5)
    assert proofs.needs_review("abc", first=False, accuracy_m=31)


def test_one_in_five_of_the_rest_is_chosen_by_the_proof_id_and_never_changes():
    ids = [f"proof{i:04d}" for i in range(1000)]
    picked = [i for i in ids if proofs.needs_review(i, first=False, accuracy_m=5)]
    assert 150 < len(picked) < 250
    assert picked == [i for i in ids if proofs.needs_review(i, first=False, accuracy_m=5)]


def test_only_real_images_are_accepted():
    assert proofs._is_image(b"\xff\xd8\xff\xe0" + b"0" * 12)
    assert proofs._is_image(b"\x89PNG\r\n\x1a\n" + b"0" * 8)
    assert proofs._is_image(b"RIFF0000WEBPVP8 ")
    assert not proofs._is_image(b"<html><body>hi</body>")
    assert not proofs._is_image(b"%PDF-1.7 0000000")
