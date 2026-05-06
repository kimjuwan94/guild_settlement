// ================================================================
//  소득신고 정산 데이터 → Firebase 즉시 강제 업로드 스크립트
//  현재 컴퓨터의 브라우저 콘솔(F12)에서 실행하세요.
// ================================================================

(async () => {
    const RIDER_KEY      = 'income_riders_v1';
    const SETTLEMENT_KEY = 'income_settlements_v1';
    const FB_RIDERS      = 'https://floche-gm-default-rtdb.firebaseio.com/income_riders.json';
    const FB_SETTLE      = 'https://floche-gm-default-rtdb.firebaseio.com/income_settlements.json';

    // 로컬 데이터 읽기
    const riders      = JSON.parse(localStorage.getItem(RIDER_KEY)      || '[]');
    const settlements = JSON.parse(localStorage.getItem(SETTLEMENT_KEY) || '[]');

    console.log(`📦 로컬 데이터 확인:`);
    console.log(`  - 라이더: ${riders.length}명`);
    console.log(`  - 정산 배치: ${settlements.length}건`);

    if (riders.length === 0 && settlements.length === 0) {
        console.warn('⚠️ 로컬에 데이터가 없습니다. 이 컴퓨터가 맞는지 확인하세요.');
        return;
    }

    // Firebase에 업로드
    console.log('🚀 Firebase에 업로드 중...');
    const [r1, r2] = await Promise.all([
        fetch(FB_RIDERS, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(riders) }),
        fetch(FB_SETTLE, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(settlements) })
    ]);

    if (r1.ok && r2.ok) {
        console.log('✅ 업로드 성공!');
        console.log(`  - 라이더 ${riders.length}명 → Firebase 저장 완료`);
        console.log(`  - 정산 배치 ${settlements.length}건 → Firebase 저장 완료`);
        console.log('👉 이제 다른 컴퓨터에서 소득신고 탭을 다시 열어보세요.');
    } else {
        console.error('❌ 업로드 실패:', r1.status, r2.status);
    }
})();
