import importlib.util, pathlib, unittest
spec=importlib.util.spec_from_file_location("auth_config",pathlib.Path(__file__).resolve().parents[1]/"scripts"/"auth-config.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ConfigTest(unittest.TestCase):
    def test_repair_preserves_other_redirects(self):
        patch=m.make_patch({"site_url":"http://localhost:3000","uri_allow_list":"https://example.invalid/callback","mailer_autoconfirm":True})
        self.assertEqual(patch["site_url"],m.SITE)
        self.assertEqual(patch["uri_allow_list"],",".join(("https://example.invalid/callback",*m.REQUIRED_CALLBACKS)))
        self.assertIs(patch["mailer_autoconfirm"],False)
        self.assertNotIn("smtp_pass",patch)
    def test_branded_migration_preserves_preview_and_other_settings(self):
        cfg={"site_url":m.PREVIEW,"uri_allow_list":m.PREVIEW+"/account,https://example.invalid/callback","disable_signup":True,"mailer_autoconfirm":False}
        patch=m.make_brand_patch(cfg)
        self.assertEqual(set(patch),{"site_url","uri_allow_list"})
        self.assertEqual(patch["site_url"],m.SITE)
        self.assertTrue(set(m.REQUIRED_CALLBACKS).issubset(set(patch["uri_allow_list"].split(","))))
        self.assertIn("https://example.invalid/callback",patch["uri_allow_list"])
        self.assertEqual(m.make_brand_patch({**cfg,**patch}),{})
    def test_no_overwrite_custom_domain(self):
        with self.assertRaises(ValueError):m.make_patch({"site_url":"https://other.example.invalid"})
    def test_smtp_requires_complete_verified_input(self):
        with self.assertRaises(ValueError):m.make_patch({},True,{})
        patch=m.make_patch({},True,{"BF_SMTP_HOST":"smtp.example.invalid","BF_SMTP_USER":"fixture","BF_SMTP_PASSWORD":"fixture-secret","BF_SMTP_FROM":"auth@example.invalid","BF_SMTP_PORT":"587"})
        self.assertEqual(patch["smtp_port"],587)
        self.assertIs(patch["mailer_autoconfirm"],False)
    def test_idempotent(self):
        cfg={"site_url":m.SITE,"uri_allow_list":",".join(m.REQUIRED_CALLBACKS),"external_email_enabled":True,"disable_signup":False,"mailer_autoconfirm":False,"mailer_secure_email_change_enabled":True}
        self.assertEqual(m.make_patch(cfg),{})
if __name__=="__main__":unittest.main()
