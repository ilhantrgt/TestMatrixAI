import { RequirementItem, TestCase, GenerationStats } from '../types';

export interface LastUpdateContext {
  action?: 'initial' | 'refine' | 'add' | 'delete' | 'auto_missing' | 'update';
  reqId?: string;
  addedCount?: number;
  lastTestCaseTitle?: string;
}

/**
 * Accurately calculates ISTQB test generation and coverage statistics
 */
export function calculateGenerationStats(
  requirements: RequirementItem[],
  testCases: TestCase[]
): GenerationStats {
  const totalRequirements = requirements.length;
  const totalTestCases = testCases.length;

  const positiveCount = testCases.filter((tc) =>
    /pozitif|happy|olumlu|positive/i.test(String(tc.testType || ''))
  ).length;

  const negativeCount = testCases.filter((tc) =>
    /negatif|hata|istisna|negative|error/i.test(String(tc.testType || ''))
  ).length;

  const boundaryCount = testCases.filter((tc) =>
    /sınır|bva|boundary|limit/i.test(String(tc.testType || ''))
  ).length;

  const securityCount = testCases.filter((tc) =>
    /güvenlik|security|yetki|auth/i.test(String(tc.testType || ''))
  ).length;

  const performanceCount = testCases.filter((tc) =>
    /performans|performance|yük|load/i.test(String(tc.testType || ''))
  ).length;

  const highPriorityCount = testCases.filter(
    (tc) => tc.priority === 'Yüksek' || tc.priority === 'High'
  ).length;

  // Track requirement IDs covered by test cases (case-insensitive & trimmed)
  const coveredReqIds = new Set(
    testCases
      .map((tc) => String(tc.reqId || '').toLowerCase().trim())
      .filter(Boolean)
  );

  let fullyCoveredReqs = 0;
  let partiallyCoveredReqs = 0;
  let uncoveredReqs = 0;

  requirements.forEach((req) => {
    const id = String(req.id || '').toLowerCase().trim();
    const testsForReq = testCases.filter(
      (tc) => String(tc.reqId || '').toLowerCase().trim() === id
    );

    if (testsForReq.length === 0) {
      uncoveredReqs++;
    } else {
      const hasPos = testsForReq.some((tc) =>
        /pozitif|happy|positive/i.test(String(tc.testType || ''))
      );
      const hasNegOrBva = testsForReq.some((tc) =>
        /negatif|hata|sınır|bva|boundary|negative/i.test(String(tc.testType || ''))
      );
      if (hasPos && hasNegOrBva && testsForReq.length >= 2) {
        fullyCoveredReqs++;
      } else {
        partiallyCoveredReqs++;
      }
    }
  });

  const reqsWithTests = requirements.filter((r) =>
    coveredReqIds.has(String(r.id || '').toLowerCase().trim())
  ).length;

  const coverageScore =
    totalRequirements > 0
      ? Math.round((reqsWithTests / totalRequirements) * 100)
      : totalTestCases > 0
      ? 100
      : 0;

  return {
    totalRequirements,
    totalTestCases,
    fullyCoveredReqs,
    partiallyCoveredReqs,
    uncoveredReqs,
    positiveCount,
    negativeCount,
    boundaryCount,
    securityCount,
    performanceCount,
    highPriorityCount,
    coverageScore,
  };
}

/**
 * Generates dynamic, context-aware QA Engineering Assessment & Risk Detection points
 * tailored directly to the supplied requirements and test cases.
 */
export function generateEngineeringRecommendations(
  requirements: RequirementItem[],
  testCases: TestCase[],
  language: string = 'tr',
  lastUpdateContext?: LastUpdateContext
): string[] {
  const isTr = language !== 'en';

  if (!requirements || requirements.length === 0) {
    if (testCases && testCases.length > 0) {
      return isTr
        ? [
            `Sistemde ${testCases.length} adet test senaryosu bulunmaktadır. İlgili gereksinim dokümanı yüklendiğinde uçtan uca izlenebilirlik (RTM) analizi oluşturulacaktır.`,
            'Senaryoların öncelik ve tip dağılımı ISTQB standartlarına göre gözden geçirilmiştir.',
          ]
        : [];
    }
    return [];
  }

  const reqIds = requirements.map((r) => r.id).filter(Boolean);
  const totalTCs = testCases.length;
  const stats = calculateGenerationStats(requirements, testCases);

  const reqListDisplay =
    reqIds.length <= 5
      ? `[${reqIds.join(', ')}]`
      : `[${reqIds.slice(0, 3).join(', ')} ... ${reqIds[reqIds.length - 1]}] (${reqIds.length} gereksinim maddesi)`;

  const totalSteps = testCases.reduce(
    (acc, tc) => acc + (Array.isArray(tc.steps) ? tc.steps.length : 1),
    0
  );

  // Semantic content scan for domain risks
  const fullText = (
    requirements
      .map((r) => `${r.id} ${r.title} ${r.description} ${r.category}`)
      .join(' ') +
    ' ' +
    testCases
      .map((tc) => `${tc.title} ${tc.description} ${tc.expectedResult || ''} ${tc.testData || ''}`)
      .join(' ')
  ).toLowerCase();

  const recommendations: string[] = [];

  // 1. Live Update Bullet (if triggered by adding/refining a test case)
  if (lastUpdateContext && lastUpdateContext.reqId) {
    const { reqId, addedCount, lastTestCaseTitle } = lastUpdateContext;
    const countText = addedCount && addedCount > 1 ? `${addedCount} yeni test senaryosu` : 'yeni test senaryosu';
    const titleSnippet = lastTestCaseTitle ? ` ("${lastTestCaseTitle.slice(0, 45)}...")` : '';

    if (isTr) {
      recommendations.push(
        `Dinamik Senaryo Güncellemesi: [${reqId}] gereksinimi için ${countText}${titleSnippet} başarıyla üretildi ve matrise eklendi. Test derinliği genişletildi, risk değerlendirmesi anlık olarak güncellendi.`
      );
    } else {
      recommendations.push(
        `Dynamic Scenario Update: Successfully generated ${countText}${titleSnippet} for [${reqId}]. Test depth and risk metrics refreshed in real time.`
      );
    }
  }

  // 2. Requirement Scope & RTM Traceability
  if (totalTCs === 0) {
    recommendations.push(
      isTr
        ? `Analiz Edilen Gereksinimler: ${reqListDisplay} maddeleri tanımlandı. 'Test Senaryoları Üret' butonu ile ISTQB standartlarında Happy Path, Negatif ve Sınır Değer senaryoları türetilmelidir.`
        : `Analyzed Requirements: ${reqListDisplay} loaded. Generate test cases to establish full ISTQB traceability.`
    );
    return recommendations;
  }

  if (isTr) {
    recommendations.push(
      `Gereksinim Kapsamı & RTM İzlenebilirliği: ${reqListDisplay} maddeleri için toplam ${totalTCs} adet test senaryosu ve ${totalSteps} adet adım bazlı doğrulama noktası eşleştirildi. Kapsama oranı: %${stats.coverageScore}.`
    );
  } else {
    recommendations.push(
      `Requirement Coverage & RTM Traceability: A total of ${totalTCs} test cases and ${totalSteps} verification steps were mapped across ${reqListDisplay} (Coverage: ${stats.coverageScore}%).`
    );
  }

  // 3. ISTQB Balance & Negative / Boundary Ratio
  const posPct = totalTCs > 0 ? Math.round((stats.positiveCount / totalTCs) * 100) : 0;
  const negPct = totalTCs > 0 ? Math.round((stats.negativeCount / totalTCs) * 100) : 0;
  const bvaPct = totalTCs > 0 ? Math.round((stats.boundaryCount / totalTCs) * 100) : 0;

  if (isTr) {
    const balanceWarning =
      negPct < 25
        ? `İkaz: Negatif senaryo oranı (%${negPct}) düşüktür; sistem dayanıklılığı ve hata yönetimi için ek negatif senaryolar türetilmesi önerilir.`
        : `Happy Path (%${posPct}) ve Negatif Hata Yönetimi (%${negPct}) senaryoları ISTQB standartlarında dengeli dağılmıştır.`;

    recommendations.push(
      `ISTQB Test Türü Analizi: %${posPct} Pozitif (${stats.positiveCount}), %${negPct} Negatif (${stats.negativeCount}), %${bvaPct} Sınır Değer/BVA (${stats.boundaryCount})${stats.securityCount > 0 ? `, ${stats.securityCount} Güvenlik senaryosu` : ''}. ${balanceWarning}`
    );
  } else {
    const balanceWarning =
      negPct < 25
        ? `Warning: Low negative scenario ratio (${negPct}%); additional negative tests recommended.`
        : `Happy Path (${posPct}%) and Negative Exception handling (${negPct}%) are well balanced.`;

    recommendations.push(
      `ISTQB Test Type Distribution: ${posPct}% Positive (${stats.positiveCount}), ${negPct}% Negative (${stats.negativeCount}), ${bvaPct}% Boundary (${stats.boundaryCount})${stats.securityCount > 0 ? `, ${stats.securityCount} Security` : ''}. ${balanceWarning}`
    );
  }

  // 4. Domain & Business Rule Risk Analysis (Active Tasks, Deletion, Constraints, Cascade)
  const hasActiveTaskConstraint =
    /aktif.*görev|göreve.*bağlı|bağlı.*silin|silinemez|silme.*kısıt|kullanımda.*sil|foreign.*key|in-use.*delete|depend.*task|aktif.*iş/i.test(
      fullText
    );

  const hasAdapterOrIntegration =
    /adaptör|servis|api.*entegrasyon|bağlantı|webhook|endpoint|socket|adapter|protokol/i.test(
      fullText
    );

  const hasPaymentOrFinance =
    /ödeme|bakiye|tutar|fiyat|fatura|transfer|kredi|payment|balance|price|tahsilat/i.test(
      fullText
    );

  if (hasActiveTaskConstraint) {
    if (isTr) {
      recommendations.push(
        `Kritik İş Kuralı Riski (Bağımlı Kayıt & Silme Kısıtı): Aktif göreve/iş akışına bağlı nesnelerin (örn. aktif adaptörler) silinmesini engelleyen kural, veri tabanı referans bütünlüğü ve eşzamanlı silme istekleri (race condition) açısından yüksek risk taşımaktadır. UI engeliyle yetinilmeyip backend 409/400 kısıt doğrulama ve veritabanı cascade/kilit testleri doğrulanmalıdır.`
      );
    } else {
      recommendations.push(
        `Critical Business Logic Risk (In-Use Record Deletion Constraint): Business rules preventing deletion of entities tied to active tasks/jobs carry high risk for race conditions and data integrity. Backend HTTP 409/400 validation and database foreign-key constraint tests are required beyond UI disabled states.`
      );
    }
  } else if (hasAdapterOrIntegration) {
    if (isTr) {
      recommendations.push(
        `Entegrasyon ve Protokol Riski: Dış servis ve adaptör bağlantılarında ağ kesintisi, zaman aşımı (timeout [408/504]) ve servis sağlayıcı yanıt gecikmesi durumlarında yeniden deneme (retry/exponential backoff) mekanizması ve hata loglaması doğrulanmalıdır.`
      );
    } else {
      recommendations.push(
        `Integration & Protocol Risk: Adapter/service connections must be verified against network dropouts, request timeouts (408/504), and retry/backoff mechanisms.`
      );
    }
  } else if (hasPaymentOrFinance) {
    if (isTr) {
      recommendations.push(
        `Mali ve İşlem Bütünlüğü Riski: Finansal hesaplama, bakiye güncelleme ve mükerrer istek (idempotency / double-spending) senaryoları işlem kilitleri (transaction isolation) altında doğrulanmalıdır.`
      );
    } else {
      recommendations.push(
        `Financial Transaction & Idempotency Risk: Double-spending and balance calculation rules must be tested under database transaction isolation.`
      );
    }
  }

  // 5. Boundary Value Analysis (BVA), Format Validation & Security Privileges
  const hasBoundaryAndFormat =
    /port|ip|karakter|uzunluk|format|boyut|limit|regex|url|min.*max|sayı|harf|boş|null/i.test(
      fullText
    );

  const hasSecurityOrRoles =
    /yetki|rol|admin|oturum|izin|token|auth|unauthorized|forbidden|jwt|şifre/i.test(
      fullText
    );

  if (hasBoundaryAndFormat) {
    if (isTr) {
      recommendations.push(
        `Sınır Değer (BVA) & Veri Doğrulama: Port aralıkları (1-65535), IP formatları, maksimum karakter limitleri ve boş/null girdilerde sınır altı/üstü değerler ile XSS/SQL özel karakter filtrelemesi test edilmelidir.`
      );
    } else {
      recommendations.push(
        `Boundary Value (BVA) & Input Validation: Format boundaries (Port [1-65535], IP address patterns, character length limits, null values) and XSS/SQL special characters must be verified.`
      );
    }
  } else if (hasSecurityOrRoles) {
    if (isTr) {
      recommendations.push(
        `Yetkilendirme ve Rol İzolasyonu: Farklı kullanıcı rolleri (Admin, Operatör, Yetkisiz Kullanıcı) arasındaki operasyonel kısıtlar ve yetkisiz uç nokta manipülasyonu (IDOR) API seviyesinde test edilmelidir.`
      );
    } else {
      recommendations.push(
        `Role-Based Authorization & IDOR Risk: Privileged action boundaries between user roles and direct API endpoint tampering (IDOR) must be tested.`
      );
    }
  }

  // 6. Coverage Gap Alert or 100% Assurance
  const uncoveredOrPartial = requirements.filter(
    (r) => r.coverageStatus === 'Partial' || r.coverageStatus === 'Uncovered'
  );

  if (uncoveredOrPartial.length > 0) {
    const gapIds = uncoveredOrPartial.map((r) => r.id);
    if (isTr) {
      recommendations.push(
        `Kapsama Açığı Uyarısı: [${gapIds.join(', ')}] gereksinimlerinde kısmi test kapsamı tespit edildi. RTM matrisi üzerinden 'Eksikleri Otomatik Üret' aksiyonu ile ISTQB standardına (%100) ulaştırılması önerilir.`
      );
    } else {
      recommendations.push(
        `Coverage Gap Alert: Requirements [${gapIds.join(', ')}] have partial coverage. Expanding missing edge cases via RTM is recommended.`
      );
    }
  } else {
    if (isTr) {
      recommendations.push(
        `Tam Kapsama & Regresyon Güvencesi: Tüm gereksinim maddeleri (%100) test senaryolarıyla eksiksiz eşleştirilmiştir. Senaryolar test koşumuna (Test Run) ve CI/CD otomasyon paketine dahil edilmeye hazırdır.`
      );
    } else {
      recommendations.push(
        `Full Coverage & Regression Ready: All requirements (100%) are mapped to test cases and ready for execution runs and automation pipelines.`
      );
    }
  }

  return recommendations;
}
