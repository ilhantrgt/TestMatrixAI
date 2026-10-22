import { SampleRequirementDoc } from '../types';

export const SAMPLE_REQUIREMENT_DOCS: SampleRequirementDoc[] = [
  {
    id: 'e-commerce-checkout',
    title: 'E-Ticaret Sepet ve Kredi Kartı Ödeme Modülü (SRS)',
    category: 'E-Commerce / Fintech',
    description: 'Sipariş özeti, promosyon kodu indirimi, 3D Secure kredi kartı ödemesi ve stok düşümü gereksinimleri.',
    content: `YAZILIM GEREKSİNİM DÖKÜMANI (SRS)
Modül: E-Ticaret Sepet & Ödeme Sistemi
Versiyon: v2.4

[REQ-PAY-01] Sepet Hesaplama ve Promosyon Kodu
- Kullanıcı sepetindeki ürünlerin birim fiyatlarını ve KDV oranlarını doğru hesaplamalıdır.
- Geçerli bir indirim kuponu girildiğinde (ör. 'YAZ2026') toplam tutara %20 indirim uygulanmalıdır.
- Geçersiz veya süresi dolmuş kupon girildiğinde "Kupon kodu geçersiz veya süresi dolmuş" hatası gösterilmelidir.
- Minimum sepet tutarı 250 TL altında olduğunda kupon uygulamasına izin verilmemeli ve kullanıcı bilgilendirilmelidir.

[REQ-PAY-02] Kredi Kartı Bilgileri Doğrulama
- Kredi kartı numarası Luhn algoritması kontrolünden geçmelidir (16 hane).
- Son kullanma tarihi (AA/YY) geçmiş tarihler için kabul edilmemelidir.
- CVV kodu 3 veya 4 haneli sayısal değer olmalıdır.
- Kart numarası maskelenerek (ilk 6 ve son 4 hane açık, ortadaki 6 hane '*') ekranda tutulmalı, CVV veritabanına asla kaydedilmemelidir.

[REQ-PAY-03] 3D Secure Doğrulama ve Sipariş Onayı
- 3D Secure seçeneği varsayılan olarak aktif gelmelidir.
- Banka SMS şifresi ekranında 180 saniyelik geri sayım süresi olmalıdır. Süre dolduğunda SMS yeniden gönder butonu aktif olmalıdır.
- SMS doğrulama kodu 3 kez üst üste hatalı girilirse işlem iptal edilmeli ve kart 15 dakika bloke uyarısı vermelidir.
- Başarılı ödeme sonrası sipariş numarası (ör. ORD-2026-9912) üretilmeli, kullanıcıya SMS/E-posta ile konfirmasyon gönderilmeli ve stok miktarları anlık güncellenmelidir.`,
  },
  {
    id: 'banking-eft-transfer',
    title: 'Mobil Bankacılık FAST / EFT Para Transferi PRD',
    category: 'Bankacılık & Finans',
    description: 'IBAN/Kolay Adres ile para transferi, günlük limit kontrolleri, komisyon hesabı ve biyometrik onay.',
    content: `YAZILIM GEREKSİNİM DÖKÜMANI (SRS)
Modül: Mobil Bankacılık FAST ve EFT Para Transferi
Versiyon: v1.8

[REQ-TRF-01] Alıcı IBAN ve Kolay Adres Doğrulama
- Kullanıcı TR ile başlayan 26 haneli IBAN veya Kolay Adres (Telefon / TCKN / E-posta) girebilmelidir.
- IBAN girildiğinde banka API'si üzerinden alıcının Ad-Soyad maskeli unvanı (ör: İH*** T**GT) otomatik getirilmelidir.
- Geçersiz IBAN formatı girildiğinde buton pasif kalmalı ve "Lütfen geçerli bir TR IBAN giriniz" uyarısı verilmelidir.

[REQ-TRF-02] Transfer Tutarı ve Günlük Limit Kontrolleri
- Minimum transfer tutarı 1,00 TL olmalıdır.
- Bireysel müşteriler için tek seferde FAST üst limiti 100.000 TL, günlük toplam limit 250.000 TL'dir.
- Günlük limiti aşan transfer denemelerinde "Günlük FAST transfer limitinizi (250.000 TL) aştınız" hata mesajı dönmelidir.
- Müşteri hesabında yeterli bakiye veya Ek Hesap limiti bulunmuyorsa transfer adımı engellenmelidir.

[REQ-TRF-03] Biyometrik Onay ve Güvenlik Seviyesi
- 20.000 TL üzerindeki transferlerde Biyometrik Onay (FaceID / Fingerprint) veya SMS OTP ek güvenlik adımı zorunlu kılınmalıdır.
- Şüpheli işlem analizi (Fraud Engine) yüksek risk skoru üretirse işlem dondurulmalı ve Müşteri Hizmetleri yönlendirmesi yapılmalıdır.`,
  },
  {
    id: 'user-auth-rbac',
    title: 'Kullanıcı Kimlik Doğrulama & Yetkilendirme (OAuth & RBAC)',
    category: 'Sistem & Güvenlik',
    description: 'Parola politikası, TOTP İki Faktörlü Doğrulama (2FA), Rol Tabanlı Erişim Kontrolü (RBAC) ve Brute Force koruması.',
    content: `YAZILIM GEREKSİNİM DÖKÜMANI (SRS)
Modül: Kullanıcı Kimlik Doğrulama & Yetkilendirme Servisi
Versiyon: v3.1

[REQ-AUTH-01] Parola Güvenlik Politikası
- Parola en az 8, en fazla 32 karakter uzunluğunda olmalıdır.
- En az 1 büyük harf, 1 küçük harf, 1 rakam ve 1 özel karakter (!@#$%^&*) içermelidir.
- Son 5 parola ile aynı parola yeniden belirlenememelidir.

[REQ-AUTH-02] Brute Force ve Hesap Kilitleme
- Aynı IP veya kullanıcı adı ile 5 kez üst üste hatalı parola girilirse hesap 30 dakika süreyle geçici olarak kilitlenmelidir.
- Kullanıcıya "Çok sayıda hatalı deneme nedeniyle hesabınız 30 dakika kilitlenmiştir. Parolanızı sıfırlayabilirsiniz." mesajı verilmelidir.

[REQ-AUTH-03] Rol Tabanlı Erişim Kontrolü (RBAC)
- 'Sistem Yöneticisi' (Admin), 'Test Mühendisi' (QA) ve 'İzleyici' (Viewer) olmak üzere 3 temel rol tanımlanmalıdır.
- 'İzleyici' rolündeki kullanıcılar veri silme veya düzenleme butonlarını görememeli, yalnızca okuma yetkisine sahip olmalıdır.
- Yetkisiz bir URL adresi doğrudan çağrıldığında sistem HTTP 403 Forbidden hatası ve uygun arayüz uyarı mesajı üretmelidir.`,
  },
];
