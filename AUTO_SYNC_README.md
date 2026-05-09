# 🔄 Auto-Sync System for bb-space-website

Sistem auto-sync yang secara otomatis menyinkronkan setiap perubahan kode dengan GitHub repository.

## 🚀 Cara Penggunaan

### 1. **Sync Manual (On-Demand)**

```bash
# Jalankan sync manual kapan saja
./auto-sync.sh
```

### 2. **Sync Otomatis dengan Watcher**

```bash
# Jalankan di background untuk monitoring berkelanjutan
./watch-sync.sh &

# Atau jalankan di screen/tmux untuk persistent
screen -S autosync ./watch-sync.sh
```

### 3. **Sync via Git Hooks (Otomatis)**

Git hooks sudah terpasang dan akan otomatis berjalan saat:

- **Pre-commit**: Auto-add semua perubahan sebelum commit
- **Post-commit**: Auto-push ke GitHub setelah commit

## 📁 File Sistem

```
auto-sync.sh          # Script utama untuk sync manual
watch-sync.sh         # Watcher untuk monitoring berkelanjutan
.git/hooks/pre-commit # Hook untuk auto-add sebelum commit
.git/hooks/post-commit# Hook untuk auto-push setelah commit
auto-sync.log         # Log semua aktivitas sync
```

## 🔧 Cara Kerja

### **Mode Otomatis (Recommended)**

1. Setiap kali Anda save file, git hooks akan mendeteksi perubahan
2. Pre-commit hook akan menambahkan semua perubahan (`git add .`)
3. Jika ada perubahan, commit akan dibuat dengan pesan otomatis
4. Post-commit hook akan push ke GitHub

### **Mode Manual**

1. Jalankan `./auto-sync.sh` kapan saja diperlukan
2. Script akan check perubahan, commit, dan push otomatis

### **Mode Watcher**

1. Jalankan `./watch-sync.sh` untuk monitoring 24/7
2. Setiap 5 menit akan check perubahan dan sync otomatis

## 📊 Format Commit Message

Commit otomatis menggunakan format:

```
auto-sync: X files changed - [file1, file2, ...] (YYYY-MM-DD HH:MM:SS)
```

Contoh:

```
auto-sync: 3 files changed - src/auth.tsx, src/components/button.tsx, package.json (2026-05-09 14:30:15)
```

## 🔍 Monitoring

### **Check Status Sync**

```bash
# Lihat log aktivitas
tail -f auto-sync.log

# Check status git
git status
git log --oneline -5
```

### **Troubleshooting**

```bash
# Jika ada konflik merge
git pull --rebase origin main
./auto-sync.sh

# Restart watcher jika berhenti
pkill -f watch-sync.sh
./watch-sync.sh &
```

## ⚙️ Konfigurasi

### **Ubah Interval Watcher**

Edit `watch-sync.sh`:

```bash
SYNC_INTERVAL=300  # Ubah dari 300 detik (5 menit) ke interval lain
```

### **Exclude Files dari Auto-Sync**

Tambahkan ke `.gitignore` atau edit `auto-sync.sh` untuk skip file tertentu.

## 🛡️ Keamanan

- ✅ Semua credentials sudah di-exclude dari sync
- ✅ File sensitif (.env, secrets) tidak akan di-sync
- ✅ Git hooks hanya menjalankan operasi git standar
- ✅ Tidak ada akses ke credentials atau API keys

## 📈 Benefits

- **Zero-effort sync**: Kode selalu tersimpan di GitHub
- **Real-time backup**: Setiap perubahan langsung di-backup
- **Team collaboration**: Perubahan langsung terlihat oleh tim
- **Version control**: History lengkap semua perubahan
- **Deployment ready**: Repository selalu up-to-date untuk CI/CD

## 🚨 Important Notes

- **Jangan edit file secara simultan** dari multiple sessions
- **Review commits** sebelum push production
- **Monitor log** untuk memastikan sync berjalan lancar
- **Backup penting** sebelum major refactoring

---

**Status**: ✅ **AKTIF & SIAP DIGUNAKAN**

Auto-sync system sudah terpasang dan siap digunakan untuk menyinkronkan setiap perubahan kode dengan GitHub repository.
