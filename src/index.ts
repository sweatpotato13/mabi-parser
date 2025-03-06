/* eslint-disable */
import puppeteer from 'puppeteer';
import fs from 'fs';

interface Item {
    name: string;
    id: string;
}

(async () => {
    let browser;
    const itemSet = new Set<string>();

    // 오늘 날짜의 파일명 생성
    const filename = `./results/items.json`;
    const backupFilename = `./results/items.backup.json`;

    // results 디렉토리가 없으면 생성
    if (!fs.existsSync('./results')) {
        fs.mkdirSync('./results');
    }

    // 기존 파일이 있다면 백업
    if (fs.existsSync(filename)) {
        fs.copyFileSync(filename, backupFilename);
        console.log(`기존 파일을 ${backupFilename}으로 백업했습니다.`);
    }

    // 결과를 JSON 파일로 저장하고 검증하는 함수
    const saveResults = async (finalSave: boolean = false) => {
        const uniqueItems = Array.from(itemSet).map(item => JSON.parse(item));
        try {
            await fs.promises.writeFile(filename, JSON.stringify(uniqueItems, null, 2));
            
            // 최종 저장시에만 검증 수행
            if (finalSave) {
                const minAcceptableItems = 30000; // 최소 허용 아이템 수 설정
                
                if (uniqueItems.length < minAcceptableItems) {
                    console.log(`수집된 아이템 수(${uniqueItems.length})가 최소 기준(${minAcceptableItems})보다 적습니다.`);
                    if (fs.existsSync(backupFilename)) {
                        fs.copyFileSync(backupFilename, filename);
                        console.log('백업 파일을 복원했습니다.');
                    }
                } else {
                    console.log(`총 ${uniqueItems.length}개의 아이템이 성공적으로 저장되었습니다.`);
                    // 백업 파일 삭제
                    if (fs.existsSync(backupFilename)) {
                        fs.unlinkSync(backupFilename);
                    }
                }
            }
        } catch (error) {
            console.error('파일 저장 중 에러:', error);
            if (fs.existsSync(backupFilename)) {
                fs.copyFileSync(backupFilename, filename);
                console.log('에러가 발생하여 백업 파일을 복원했습니다.');
            }
        }
    };

    // 프로세스 종료 시 처리
    const cleanup = async () => {
        console.log('\n종료 신호를 받았습니다. 데이터를 저장합니다...');
        try {
            if (browser) {
                await browser.close();
            }
            await saveResults(true); // 최종 저장 플래그를 true로 설정
            console.log('정상적으로 종료되었습니다.');
        } catch (error) {
            console.error('종료 중 에러 발생:', error);
        } finally {
            // 백업 파일이 남아있다면 삭제
            if (fs.existsSync(backupFilename)) {
                fs.unlinkSync(backupFilename);
            }
            setTimeout(() => process.exit(0), 1000);
        }
    };

    // SIGINT (Ctrl+C) 및 SIGTERM 처리
    process.on('SIGINT', async () => {
        await cleanup();
    });
    process.on('SIGTERM', async () => {
        await cleanup();
    });

    // 예기치 않은 에러 처리
    process.on('uncaughtException', async (error) => {
        console.error('예기치 않은 에러:', error);
        await cleanup();
    });

    try {
        // 기존 브라우저 실행 코드 수정
        browser = await puppeteer.launch({
            headless: true,
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        // 새 페이지 열기
        const page = await browser.newPage();

        await page.goto('https://prilus.gitlab.io/item', {
            waitUntil: 'networkidle2',
        });

        // 페이지가 완전히 로드될 때까지 추가 대기
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        let previousItemCount = 0;
        let sameCountStreak = 0;  // 연속으로 같은 개수가 나온 횟수

        while (true) {
            // 현재 페이지에서 데이터를 수집
            const items: Item[] = await page.evaluate(() => {
                const container = document.querySelector('.v-window__container');
                if (!container) return [];

                // 컨테이너 내부의 모든 카드 선택
                return Array.from(container.querySelectorAll('.v-card.v-theme--dark')).map((card) => {
                    const fullText = (card.querySelector('p')?.textContent || '').trim();

                    // 마지막 숫자 부분을 ID로 추출
                    const match = fullText.match(/^(.+?)\s+(\d+)$/);
                    if (!match) return null;

                    const [, name, id] = match;
                    return {
                        name: name.trim(),
                        id
                    };
                }).filter((item): item is Item => item !== null);
            });

            // 중복되지 않은 아이템만 추가 (ID를 키로 사용)
            items.forEach(item => itemSet.add(JSON.stringify(item)));
            const currentItemCount = itemSet.size;
            console.log(`현재 수집된 아이템 개수: ${currentItemCount}`);

            // 이전 개수와 비교하여 연속 카운트 업데이트
            if (currentItemCount === previousItemCount) {
                sameCountStreak++;
                console.log(`같은 개수 연속 ${sameCountStreak}번 발생`);
            } else {
                sameCountStreak = 0;
                previousItemCount = currentItemCount;
            }

            // 3번 연속으로 같은 개수가 나오면 종료
            if (sameCountStreak >= 3) {
                console.log('3번 연속으로 같은 개수가 나와서 종료합니다.');
                break;
            }

            // 스크롤 처리
            await page.evaluate(() => {
                const container = document.querySelector('.v-window__container');
                if (!container) return;

                const virtualItems = container.querySelectorAll('.v-virtual-scroll__item');
                const lastItem = virtualItems[virtualItems.length - 1];
                if (lastItem) {
                    lastItem.scrollIntoView({ behavior: 'auto', block: 'center' });
                }
            });

            // virtual scroll이 업데이트되기를 기다림
            await new Promise(resolve => setTimeout(resolve, 10));

            // 매 반복마다 결과 저장 (덮어쓰기)
            await saveResults(false);
        }

        // 정상 종료 시에도 결과 저장
        await saveResults(true);
        await browser.close();

    } catch (error) {
        console.error('에러 발생:', error);
        await cleanup();
    }
})();