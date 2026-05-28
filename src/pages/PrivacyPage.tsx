import { useNavigate } from 'react-router-dom'

export default function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-text-muted hover:text-primary mb-6 flex items-center gap-1"
        >
          ← 뒤로
        </button>

        <div className="card p-6 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-text">개인정보처리방침</h1>
            <p className="text-xs text-text-muted mt-1">시행일: 2025년 1월 1일 / 최종 수정: 2026년 5월 28일</p>
          </div>

          <Section title="1. 수집하는 개인정보 항목">
            <p>서비스 이용을 위해 다음의 개인정보를 수집합니다.</p>
            <ul>
              <li><strong>회원가입 시:</strong> 이메일 주소, 이름</li>
              <li><strong>Google 로그인 시:</strong> Google 계정에서 제공하는 이메일 주소, 이름, 프로필 사진</li>
              <li><strong>서비스 이용 시:</strong> 사용자가 직접 입력한 아파트 정보, 시세 데이터, 메모 (개인정보 해당 없음)</li>
            </ul>
          </Section>

          <Section title="2. 개인정보 수집 및 이용 목적">
            <ul>
              <li>회원 식별 및 서비스 제공</li>
              <li>계정 보호 및 부정 이용 방지</li>
              <li>회원 탈퇴 시 관련 데이터 삭제 처리</li>
            </ul>
          </Section>

          <Section title="3. 개인정보 보유 및 이용 기간">
            <p>회원 탈퇴 시 또는 수집·이용 목적 달성 후 즉시 파기합니다.</p>
            <p className="mt-1">단, 관계법령에 의해 보존 의무가 있는 경우 해당 기간 동안 보관합니다.</p>
          </Section>

          <Section title="4. 개인정보의 제3자 제공">
            <p>수집한 개인정보를 원칙적으로 외부에 제공하지 않습니다.</p>
            <p className="mt-1">단, Google Firebase(Google LLC)의 인증 및 데이터베이스 서비스를 이용하며, Firebase의 개인정보 보호정책이 적용됩니다.</p>
          </Section>

          <Section title="5. 개인정보 처리 위탁">
            <table className="w-full text-sm border border-border rounded-lg overflow-hidden mt-1">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-text-secondary text-xs">수탁업체</th>
                  <th className="text-left px-3 py-2 font-semibold text-text-secondary text-xs">업무 내용</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-3 py-2">Google LLC (Firebase)</td>
                  <td className="px-3 py-2">인증 서비스, 데이터베이스 저장</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section title="6. 이용자의 권리와 행사 방법">
            <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
            <ul>
              <li>개인정보 열람 요청</li>
              <li>오류 정정 요청</li>
              <li>삭제 요청 (서비스 내 회원 탈퇴 기능 이용)</li>
              <li>처리 정지 요청</li>
            </ul>
          </Section>

          <Section title="7. 개인정보 보호를 위한 기술적 조치">
            <ul>
              <li>Firebase Authentication을 통한 안전한 인증</li>
              <li>Firestore Security Rules를 통해 본인 데이터만 접근 허용</li>
              <li>HTTPS 통신 암호화</li>
              <li>비밀번호는 Firebase에서 해시 처리되어 평문으로 저장되지 않음</li>
            </ul>
          </Section>

          <Section title="8. 개인정보보호 책임자">
            <p>개인정보 처리에 관한 업무를 담당하며, 이용자의 불만을 처리합니다.</p>
            <p className="mt-1">이메일: nahee.gwon@gmail.com</p>
          </Section>

          <p className="text-xs text-text-muted pt-2 border-t border-border">
            본 방침은 서비스 정책 변경에 따라 수정될 수 있으며, 변경 시 서비스 내 공지를 통해 안내합니다.
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-text">{title}</h2>
      <div className="text-sm text-text-muted leading-relaxed space-y-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        {children}
      </div>
    </div>
  )
}
