import * as fs from 'fs';
import * as path from 'path';

import { parseEnchantWebsite } from '../index';

async function generateEnchantFile() {
    try {
        const enchantData = await parseEnchantWebsite();
        
        // 파일 내용 생성
        const fileContent = `import { EnchantInfo } from './types';

export const ENCHANT_OPTIONS: { [key: string]: EnchantInfo } = ${JSON.stringify(enchantData, null, 2)};
`;
        
        // enchants.ts 파일에 저장
        const filePath = path.resolve(__dirname, '../enchants.ts');
        fs.writeFileSync(filePath, fileContent, 'utf-8');
        
        console.log('인챈트 데이터가 성공적으로 저장되었습니다.');
        
    } catch (error) {
        console.error('오류 발생:', error);
    }
}

void (async () => {
    await generateEnchantFile();
})(); 