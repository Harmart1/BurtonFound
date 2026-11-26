#!/usr/bin/env python3
"""Owner-only local encrypted logical backup; never run in public CI.
Requires Supabase CLI v3, Docker if required by CLI, age, and a private encrypted disk.
BF_DB_URL is read from environment; BF_BACKUP_RECIPIENT is an age PUBLIC key.
"""
import os, sys, subprocess, tempfile, tarfile, pathlib, datetime, hashlib, shutil
from urllib.parse import urlsplit
ROOT=pathlib.Path(__file__).resolve().parents[1]
REF="nyvdrgpcwfasajyncnhi"

def main():
    if os.environ.get("CI") or os.environ.get("GITHUB_ACTIONS"):
        sys.exit("Refusing to export a hosted database in CI.")
    if len(sys.argv)!=2:
        sys.exit("Usage: python scripts/local-encrypted-backup.py PRIVATE_OUTPUT_DIRECTORY")
    output=pathlib.Path(sys.argv[1]).expanduser().resolve()
    if output==ROOT or ROOT in output.parents:
        sys.exit("Output must be outside the repository.")
    if not output.is_dir():
        sys.exit("Create the private encrypted-disk directory first.")
    url=os.environ.get("BF_DB_URL","")
    recipient=os.environ.get("BF_BACKUP_RECIPIENT","")
    try:
        parsed=urlsplit(url)
        valid=parsed.scheme in ("postgresql","postgres") and parsed.port==5432 and parsed.path=="/postgres" and bool(parsed.password) and ((parsed.hostname=="db."+REF+".supabase.co" and parsed.username=="postgres") or (parsed.hostname.endswith(".pooler.supabase.com") and parsed.username=="postgres."+REF))
    except (ValueError,AttributeError):
        valid=False
    if not valid:
        sys.exit("Expected a password-bearing direct or session-pooler URL for the Burton & Found project on port 5432.")
    if not recipient.startswith("age1") or len(recipient)!=62 or not recipient.isalnum():
        sys.exit("Set BF_BACKUP_RECIPIENT to your age public encryption recipient (not the private key).")
    if not shutil.which("supabase") or not shutil.which("age"):
        sys.exit("Install Supabase CLI v3 and age first.")
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dest=output/("burtonfound-"+stamp+".tar.age")
    partial=dest.with_suffix(".partial")
    if dest.exists() or partial.exists():
        sys.exit("Backup filename already exists.")
    try:
        with tempfile.TemporaryDirectory(prefix="bf-private-",dir=output) as tmp:
            temp=pathlib.Path(tmp)
            env=dict(os.environ,PGSSLMODE="require")
            for name,args in [("roles.sql",["--role-only"]),("schema.sql",[]),("data.sql",["--use-copy","--data-only","-x","storage.buckets_vectors","-x","storage.vector_indexes"])]:
                # Suppress command output to avoid leaking connection details. Use only on a trusted local machine.
                result=subprocess.run(["supabase","db","dump","--remote="+url,"-f",str(temp/name),*args],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                if result.returncode or not (temp/name).is_file() or (temp/name).stat().st_size==0:
                    raise RuntimeError("Dump failed ("+name+"); no completed backup.")
            manifest=temp/"MANIFEST.sha256"
            manifest.write_text("".join(hashlib.sha256((temp/n).read_bytes()).hexdigest()+"  "+n+"\n" for n in ("roles.sql","schema.sql","data.sql")),encoding="utf-8")
            with partial.open("xb") as encrypted:
                p=subprocess.Popen(["age","-r",recipient],stdin=subprocess.PIPE,stdout=encrypted,stderr=subprocess.DEVNULL)
                try:
                    with tarfile.open(fileobj=p.stdin,mode="w|") as tar:
                        for n in ("roles.sql","schema.sql","data.sql","MANIFEST.sha256"):
                            tar.add(temp/n,arcname=n)
                    p.stdin.close()
                    if p.wait()!=0: raise RuntimeError("Encryption failed.")
                except BaseException:
                    p.kill();p.wait();raise
            if partial.stat().st_size<100: raise RuntimeError("Encrypted output incomplete.")
            partial.rename(dest)
        print("Encrypted database archive created:",dest.name)
        print("Verify decryption/checksums offline and copy ciphertext to approved private storage. Storage files and provider configuration are separate.")
    except BaseException:
        partial.unlink(missing_ok=True)
        raise
if __name__=="__main__":
    try: main()
    except Exception as exc: sys.exit("Backup failed: "+str(exc))
