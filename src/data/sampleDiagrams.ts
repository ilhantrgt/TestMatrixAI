export interface SampleDiagramDoc {
  id: string;
  title: string;
  category: string;
  format: 'mermaid' | 'plantuml';
  description: string;
  content: string;
}

export const SAMPLE_ACTIVITY_DIAGRAMS: SampleDiagramDoc[] = [
  {
    id: 'ecommerce-3ds-flow',
    title: 'E-Ticaret Ödeme & 3D Secure Akış Diyagramı',
    category: 'E-Commerce / Fintech',
    format: 'mermaid',
    description: 'Sepet doğrulama, kupon indirimi, stok kontrolü ve 3D Secure OTP tekrar deneme döngüsünü içeren Activity Diagram.',
    content: `flowchart TD
  Start([Başla: Ödeme Adımına Geç]) --> CartCheck{Sepet Tutarı >= 250 TL mi?}
  CartCheck -->|Hayır| CouponDisabled[Kupon Alanı Pasif / İndirimsiz Devam]
  CartCheck -->|Evet| ApplyCoupon{Geçerli Kupon Girildi mi?}
  ApplyCoupon -->|Evet| DiscountApplied[%20 İndirim Uygula]
  ApplyCoupon -->|Hayır| CouponError[Hata: Kupon geçersiz veya süresi dolmuş]
  CouponError --> CardEntry[Kart Bilgilerini Gir & Luhn Kontrolü]
  CouponDisabled --> CardEntry
  DiscountApplied --> CardEntry
  CardEntry --> StockCheck{Stok Yeterli mi?}
  StockCheck -->|Hayır| OutOfStock([Bitiş: Stok Yetersiz - HTTP 409])
  StockCheck -->|Evet| Bank3DS[Banka 3D Secure SMS Ekranını Aç]
  Bank3DS --> OtpValid{SMS Kodu Doğru mu?}
  OtpValid -->|Evet| OrderSuccess([Bitiş: Sipariş Onaylandı & Stok Düşüldü])
  OtpValid -->|Hayır| RetryCheck{Hatalı Deneme < 3 mü?}
  RetryCheck -->|Evet| Bank3DS
  RetryCheck -->|Hayır| CardBlocked([Bitiş: İşlem İptal & Kart 15 Dk Bloke])`,
  },
  {
    id: 'telecom-mae-workflow',
    title: 'Telekom İş Emri & MAE Durum Geçiş Süreci',
    category: 'Telekomünikasyon / WFM',
    format: 'mermaid',
    description: 'Saha ekibi iş emri yönetimi, ELE_AL, ASKIYA_AL ve DIS_SISTEM_IPTAL karar dallarını içeren süreç çizimi.',
    content: `flowchart TD
  Start([Başla: İş Emri WFM Kuyruğuna Düşer]) --> AuthCheck{Operatör Yetkisi Uygun mu?}
  AuthCheck -->|Hayır| Forbidden([Bitiş: HTTP 403 Yetkisiz Erişim])
  AuthCheck -->|Evet| TakeOrder[ELE_AL: İş Emrini Üzerine Al]
  TakeOrder --> FieldCheck{Altyapı & Port Uygun mu?}
  FieldCheck -->|Evet| DeviceCollect[CIHAZ_TOPLAMA=1/0 Kontrolü & Kurulum]
  DeviceCollect --> CompleteOrder([Bitiş: İş Emri TAMAMLANDI])
  FieldCheck -->|Hayır - Mücbir Sebep| SuspendOrder[ASKIYA_AL: Askı Kodu Seç]
  SuspendOrder --> SuspendCheck{Askıdan İndirme Talebi Geldi mi?}
  SuspendCheck -->|Evet| TakeOrder
  SuspendCheck -->|İptal| CancelOrder([Bitiş: DIS_SISTEM_IPTAL / GEREKCELI_TAMAMLANAMADI])`,
  },
  {
    id: 'credit-approval-swimlane',
    title: 'Kredi Başvuru & Paralel Risk Değerlendirme Süreci',
    category: 'Bankacılık & Finans',
    format: 'mermaid',
    description: 'Paralel KKB + Gelir sorgusu, otomatik skor eşiği kararı ve manuel yönetici onay akışı.',
    content: `flowchart TD
  Start([Başla: Müşteri Kredi Başvurusu Gönderir]) --> IdentityCheck{Kimlik & TCKN Geçerli mi?}
  IdentityCheck -->|Hayır| InvalidId([Bitiş: HTTP 400 Geçersiz Kimlik])
  IdentityCheck -->|Evet| Fork1[[Paralel Başlat: KKB & Gelir Servisi]]
  Fork1 --> KkbQuery[KKB Kredi Notu Sorgula]
  Fork1 --> IncomeQuery[SGK / Gelir Belgesi Doğrula]
  KkbQuery --> Join1[[Paralel Birleştir: Risk Skoru Hesapla]]
  IncomeQuery --> Join1
  Join1 --> ScoreDecision{Risk Skoru >= 1500 ve Tutar <= 250.000 TL?}
  ScoreDecision -->|Evet| AutoApprove([Bitiş: Otomatik Onay & Sözleşme SMS])
  ScoreDecision -->|Orta Risk: 1100-1499| ManualReview[Kredi Komitesi Manuel İnceleme]
  ScoreDecision -->|Hayır: < 1100| AutoReject([Bitiş: Otomatik Red & Bilgilendirme])
  ManualReview --> ManagerDecision{Komite Onayladı mı?}
  ManagerDecision -->|Evet| AutoApprove
  ManagerDecision -->|Hayır| AutoReject`,
  },
];
