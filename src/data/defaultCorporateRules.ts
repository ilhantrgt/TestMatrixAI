import { CorporateMemoryRule } from '../types';

export const DEFAULT_CORPORATE_RULES: CorporateMemoryRule[] = [
  {
    id: 'RULE-TT-MAE-01',
    title: 'Telekom & MAE İş Emri Durum Geçiş Kuralları',
    category: 'Telekomünikasyon',
    promptRule: `Dökümanda MAE, TTVPN, UC_CIHAZ_YER, PTS veya durum geçiş kodları (ASKIDAN_INDIR, ASKIYA_AL, DIS_SISTEM_IPTAL, ELE_AL, GEREKCELI_TAMAMLANAMADI vb.) geçtiğinde:
1. Her durum geçişi için "Bir Önceki Durum Kodu" ile "Geçiş Durum Adı" uyumunu doğrulayan pozitif durum geçiş senaryoları yazın.
2. Yetkisiz veya geçersiz önceki durumdan geçiş denendiğinde sistemin hata fırlatmasını ve işlemi engellemesini doğrulayan negatif senaryolar ekleyin.
3. Mücbir sebep askı kodları ve MAE geri dönüş parametrelerini (1/0, Başarılı/Başarısız) sınır değer analizi olarak test edin.`,
    isDefaultActive: true,
    tags: ['MAE', 'TTVPN', 'Durum Geçişleri', 'Telekom'],
    createdAt: '2026-01-01T00:00:00.000Z',
    exampleContext: 'MAE iş emri durum geçişleri ve TTVPN şablonları',
  },
  {
    id: 'RULE-WFM-XML-02',
    title: 'WFM / XML Payload & Cihaz Toplama Kuralları',
    category: 'XML & Servis Entegrasyonları',
    promptRule: `Dökümanda XML veya WFM tagleri (<wfm:resource>, <wfm:cValue key="CIHAZ_TOPLAMA"> vb.) yer aldığında:
1. CIHAZ_TOPLAMA için '1' (Evet) ve '0' (Hayır) değerlerinin ekranda Evet/Hayır metni olarak doğru formatlandığını test edin.
2. Zorunlu XML tagleri (wfm:id, typeId, TIP_KODU, MARKA_KODU) eksik veya boş gönderildiğinde schema validation hatası döndüğünü test edin.
3. Adres bloğu (ESKI_TESIS_ADRESI, GÜZELBURÇ vb.) karakter sınırları ve Türkçe karakter desteğini test edin.`,
    isDefaultActive: true,
    tags: ['WFM', 'XML', 'CIHAZ_TOPLAMA', 'Entegrasyon'],
    createdAt: '2026-01-01T00:00:00.000Z',
    exampleContext: 'CO_CPE Cihaz Toplama ve Müşteri Adres tagleri',
  },
  {
    id: 'RULE-ISTQB-STEPS-03',
    title: 'ISTQB 1-e-1 Adım ve Adım Beklenen Sonuç Standardı',
    category: 'Genel Kalite & Standartlar',
    promptRule: `Her test senaryosundaki 'steps' ve 'stepExpectedResults' dizileri:
1. Kesinlikle aynı genel cümleyi tüm adımlarda tekrarlamamalıdır.
2. Her bir adım numarası (1, 2, 3...) karşısında bağımsız, ölçülebilir ve sistem tepkisini belirten bir beklenen sonuç olmalıdır.
3. Test Data alanında gerçekçi değerler (örn: PTS, 1111, CISCO1941/K9, 04 vb.) kullanılmalıdır.`,
    isDefaultActive: true,
    tags: ['ISTQB', 'Adım Doğrulama', 'Test Verisi'],
    createdAt: '2026-01-01T00:00:00.000Z',
    exampleContext: 'Tüm modüller için adım bazlı beklenti eşleşmesi',
  },
];
