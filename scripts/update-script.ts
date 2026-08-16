import { db } from "../src/db.js";
import { sendPreview } from "../src/telegram.js";

const id = 3;
const newScript = `**Ringkasan:**  
Palantir Technologies mencatat kuartal terbaik sepanjang masa, didorong lonjakan adopsi AI di sektor pemerintah dan korporasi. CEO Alex Karp menyebut industri AI saat ini "Marxist" — mengkritik pendekatan kolektivis yang dianggap menghambat inovasi dan persaingan sehat.

**Analisis Situasi Terkini:**  
Keberhasilan Palantir membuktikan bahwa AI komersial yang terintegrasi dengan data besar (big data) mampu menghasilkan keuntungan nyata. Namun, Karp menyoroti risiko "komoditisasi" AI: model besar menjadi barang umum, sementara nilai sebenarnya ada pada aplikasi spesifik dan data eksklusif.  
Kritiknya mengarah pada kebijakan regulasi yang cenderung menyamaratakan semua pemain, tanpa mempertimbangkan perbedaan kapasitas riset dan infrastruktur.

**Prediksi ke Depan (2026–2027):**  
1. **Konsolidasi vendor:** Hanya 3–5 platform AI besar yang akan mendominasi; perusahaan menengah akan diakuisisi atau bermitra.  
2. **Regulasi berbasis risiko:** Negara akan menerapkan aturan bertingkat, bukan seragam — memungkinkan inovasi tetap jalan di sektor non-kritis.  
3. **AI sebagai utilitas:** Model dasar akan makin murah dan mudah diakses, menggeser fokus ke "solusi domain" (kesehatan, logistik, keuangan).  
4. **Peran manusia:** Permintaan tenaga ahli prompt engineering, evaluasi model, dan etika AI akan meledak — profesi baru yang tidak memerlukan gelar CS.

**Peluang untuk Audiens Awam / Lapisan Bawah Industri AI:**  
- **Belajar praktis:** Ikuti kursus singkat (Coursera, Fast.ai, atau program gratis dari Google/OpenAI) yang fokus pada penggunaan API, bukan teori mendalam.  
- **Bangun portofolio:** Buat proyek kecil dengan ChatGPT API atau Hugging Face — tunjukkan solusi nyata, bukan sekadar sertifikat.  
- **Ikuti komunitas:** Bergabung dengan forum lokal (Discord, Reddit, atau grup Telegram) untuk berbagi pengalaman dan lowongan.  
- **Spesialisasi vertikal:** Pilih satu industri (misal: agrikultur, pendidikan, UMKM) dan kuasai penerapan AI di sana — perusahaan kecil sangat membutuhkan konsultan murah.  
- **Etika & tata kelola:** Pelajari dasar-dasar privasi data dan bias algoritma — ini akan menjadi nilai jual tinggi saat regulasi makin ketat.

**Kesimpulan:**  
AI bukan lagi milik elit. Peluang terbuka lebar bagi siapa pun yang berani belajar dan beradaptasi. Karp mengingatkan bahwa industri yang "Marxist" akan menghambat semangat kewirausahaan — tapi justru di situlah celah bagi individu kreatif untuk unggul.`;

// update script
db.prepare("UPDATE contents SET script_text = ? WHERE id = ?").run(newScript, id);
console.log("Script updated");

// kirim preview baru
await sendPreview(id);
console.log("Preview dikirim ulang");