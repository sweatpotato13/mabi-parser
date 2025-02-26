import axios from 'axios';
import * as cheerio from 'cheerio';

import { EnchantInfo, EnchantStat } from './types';

export async function parseEnchantWebsite(): Promise<{ [key: string]: EnchantInfo }> {
  try {
    const enchants: { [key: string]: EnchantInfo } = {};
    let currentPage = 1;
    const LAST_PAGE = 100;

    while (currentPage <= LAST_PAGE) {
      console.log(`Parsing page ${currentPage}/${LAST_PAGE}...`);
      const response = await axios.get(`https://biketago.com/enchant/?p=${currentPage}`);
      const $ = cheerio.load(response.data);
      
      $('tbody tr').each((_, row) => {
        const columns = $(row).find('td');
        if (columns.length < 4) return;
        
        // 이름 파싱 및 분리
        const nameCell = $(columns[2]);
        const names = nameCell.html()?.split('<br>')
          .map(name => name.trim())
          .filter(name => name.length > 0) || [nameCell.text().trim()];
        
        const effectsDiv = $(columns[3]).find('div');
        const stats: EnchantStat[] = [];
        
        effectsDiv.each((_, div) => {
          const text = $(div).text().trim();
          if (!text.includes('증가') && !text.includes('감소')) return;
          
          const matches = text.match(/(.+?)\s+(\d+(?:\s*~\s*\d+)?)\s*(증가|감소)/);
          
          if (matches) {
            const [, type, value] = matches;
            
            if (value.includes('~')) {
              const [min, max] = value.split('~').map(v => parseInt(v.trim()));
              if (min !== max) {  // min과 max가 다를 때만 저장
                stats.push({ type: type.trim(), min, max });
              } else {
                stats.push({ type: type.trim(), value: min }); // 같을 때는 단일 값으로
              }
            } else {
              const numValue = parseInt(value);
              stats.push({ type: type.trim(), value: numValue }); // 단일 값으로 저장
            }
          }
        });
        
        if (stats.length > 0) {
          // 분리된 각 이름에 대해 인챈트 생성
          names.forEach(name => {
            if (name) {
              enchants[name] = { name, stats };
            }
          });
        }
      });

      currentPage++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('Total enchants parsed:', Object.keys(enchants).length);
    return enchants;
    
  } catch (error) {
    console.error('인챈트 데이터 파싱 중 오류 발생:', error);
    return {};
  }
}