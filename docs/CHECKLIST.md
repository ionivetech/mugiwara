# Mugiwara — Manual Checklist (untuk kamu)

> Semua yang butuh kredensial/akses di mesin kamu. Environment kerja tidak punya git/npm login, jadi ini manual.

## 1. Push ke GitHub

```bash
cd /mnt/d/Project/Portfolio/mugiwara
git remote add origin https://github.com/ionivetech/mugiwara.git   # jika belum ada
git branch -M main
git push -u origin main
```

> Note: repo kerja SUDAH di branch `main` dengan 49+ commits (TypeScript, README, dst). Error `src refspec master does not match any` terjadi karena branch lokal kamu `main`, bukan `master`. Jangan push `master` — push `main`.

## 2. Login npm

```bash
npm login
npm whoami   # harus cetak nama kamu
```

## 3. Jalankan semua check dulu

```bash
bun install
bun run typecheck
bun run test          # 36/36
bun run build
node dist/mugiwara.js --version    # mugiwara 0.1.0
node scripts/validate-content.mjs  # ✓ 16 skills, 11 agents
node scripts/validate-content.mjs --check-sync
```

## 4. Bump version + publish

```bash
npm version patch     # 0.1.0 → 0.1.1 (bikin git tag v0.1.1)
npm publish --access public
npm view @ionivetech/mugiwara version    # verifikasi
```

## 5. Verifikasi npx + curl

```bash
npx -y @ionivetech/mugiwara@latest --version
curl -fsSL https://raw.githubusercontent.com/ionivetech/mugiwara/main/scripts/install.sh | bash -s -- --version
```

## 6. Push tag + GitHub Release

```bash
git push origin main --tags
gh release create v0.1.1 --generate-notes --latest   # atau via web UI
```

## 7. Claude Code plugin

```bash
# di project Claude Code mana pun:
/plugin marketplace add ionivetech/mugiwara
/plugin install mugiwara
claude plugin validate --strict    # kalau CLI tersedia
```

## 8. GitHub Actions (sekali setup)

- Repo Settings → Secrets and variables → Actions:
  - `NPM_TOKEN` — buat di https://www.npmjs.com/settings/<user>/tokens (read+write publish), paste di sini.
- Setelah push, cek Actions tab: CI hijau di main; publish jalan otomatis saat tag `v*` di-push.

## 9. Checklist (ceklist)

- [ ] `git push -u origin main`
- [ ] `npm login` + `npm whoami`
- [ ] typecheck / test / build / validate hijau
- [ ] `npm version patch` + `npm publish --access public`
- [ ] `npx @ionivetech/mugiwara@latest --version` jalan
- [ ] curl installer jalan
- [ ] `git push origin main --tags`
- [ ] GitHub Release dibuat
- [ ] Claude `/plugin install mugiwara` jalan
- [ ] `NPM_TOKEN` secret ada di GitHub Actions
