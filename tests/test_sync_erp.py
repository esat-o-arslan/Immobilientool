import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("sync_erp", ROOT / "scripts" / "sync_erp.py")
sync_erp = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = sync_erp
SPEC.loader.exec_module(sync_erp)


class SyncErpTests(unittest.TestCase):
    def test_dry_run_resolves_property_reference(self):
        mapping = sync_erp.load_mapping(
            ROOT / "integrations" / "mappings" / "rimo-r5.example.json"
        )
        report = sync_erp.run_sync(
            ROOT / "data" / "sync-example", mapping, client=None, apply=False
        )
        self.assertEqual(report.created["Liegenschaft"], 1)
        self.assertEqual(report.created["KontaktPerson"], 1)
        self.assertFalse(report.skipped)

    def test_missing_reference_is_skipped(self):
        mapping = sync_erp.load_mapping(
            ROOT / "integrations" / "mappings" / "rimo-r5.example.json"
        )
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            (target / "liegenschaften.csv").write_text(
                "ObjektNr;ObjektBezeichnung;Strasse;PLZ;Ort;AnzahlEinheiten\n"
                "DEMO-001;Demo;Weg 1;4000;Basel;1\n",
                encoding="utf-8",
            )
            (target / "kontakte.csv").write_text(
                "ObjektNr;Vorname;Nachname;Rolle;E-Mail;Telefon;EinheitNr\n"
                "UNBEKANNT;Max;Muster;Mieter;max@example.invalid;;1\n",
                encoding="utf-8",
            )
            report = sync_erp.run_sync(target, mapping, client=None, apply=False)
        self.assertEqual(report.skipped["KontaktPerson"], 1)
        self.assertTrue(any("Referenz fehlt" in item for item in report.warnings))

    def test_boolean_transform(self):
        self.assertTrue(sync_erp.transform_value("Ja", "boolean"))
        self.assertFalse(sync_erp.transform_value("0", "boolean"))


if __name__ == "__main__":
    unittest.main()
