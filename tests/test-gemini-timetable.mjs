/**
 * Gemini時間割生成テスト
 * 実際の時間割生成プロンプトでのレスポンステスト
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testTimetableGeneration() {
  try {
    // wrangler.jsoncを読み込み
    const wranglerConfigText = fs.readFileSync(path.join(__dirname, 'wrangler.jsonc'), 'utf8');
    const cleanJson = wranglerConfigText.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const wranglerConfig = JSON.parse(cleanJson);
    
    const apiKey = wranglerConfig.vars?.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.log('❌ GEMINI_API_KEY が設定されていません');
      return;
    }
    
    console.log('🔄 Gemini時間割生成テスト中...\n');
    
    // 簡単な時間割生成プロンプト
    const prompt = `あなたは学校の時間割生成の専門家です。以下の情報をもとに、制約条件を満たす時間割を生成してください。

# 基本情報
学校名: テスト中学校
時間割名: 2024年度第1学期
土曜日授業時間数: 4時間

# 制約条件

## 時間構造
- 平日: 月曜日～金曜日 (1～6時限)
- 土曜日: 1～4時限 (授業あり)

## クラス情報
・1年A組 (1年生) ID: class1

## 教師情報
・山田先生 (担当: 数学) ID: teacher1

## 教科情報
・数学 ID: subject1

## 教室情報
・1-A教室 (普通教室、定員40人) ID: room1

# 生成ルール
1. 教師の時間重複は厳禁
2. 教室の時間重複は厳禁
3. 教師は担当教科のみ指導可能
4. 各クラスに適切な教科バランスを確保
5. IDは必ず提供されたものを使用

# 追加要求
数学の授業を適切に配置してください

# 出力形式
以下の正確なJSON形式で出力してください：

\`\`\`json
{
  "success": true,
  "timetable": {
    "timetableId": "test123",
    "schedules": [
      {
        "classId": "class1",
        "subjectId": "subject1",
        "teacherId": "teacher1",
        "classroomId": "room1",
        "dayOfWeek": 1,
        "period": 1
      }
    ]
  },
  "summary": {
    "totalSlots": 1,
    "classCount": 1,
    "conflicts": []
  }
}
\`\`\`

重要:
- dayOfWeek: 1=月、2=火、3=水、4=木、5=金、6=土
- period: 1-6 (土曜は1-4)
- 競合エラーは避けること
- JSONのみ出力、説明不要`;

    // Gemini APIに時間割生成リクエスト
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 6000,
          topP: 0.9,
          topK: 30
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log('❌ Gemini APIエラー:', errorData);
      return;
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0]) {
      const generatedText = data.candidates[0].content.parts
        .map(part => part.text)
        .join('');
      
      console.log('✅ Gemini生成結果:');
      console.log('=' * 50);
      console.log(generatedText);
      console.log('=' * 50);
      
      // JSON抽出とパース試行
      try {
        const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/) || 
                         generatedText.match(/```\s*([\s\S]*?)\s*```/);
        
        if (jsonMatch) {
          const jsonText = jsonMatch[1];
          console.log('\n📋 抽出されたJSON:');
          console.log(jsonText);
          
          const parsedData = JSON.parse(jsonText);
          console.log('\n✅ JSON解析成功！');
          console.log('📊 パース結果:', JSON.stringify(parsedData, null, 2));
          
          // 構造検証
          if (parsedData.timetable && parsedData.timetable.schedules) {
            console.log(`\n🎯 スケジュール数: ${parsedData.timetable.schedules.length}`);
          }
        } else {
          console.log('\n❌ JSONコードブロックが見つかりません');
        }
      } catch (parseError) {
        console.log('\n❌ JSON解析エラー:', parseError.message);
      }
      
      // 使用量情報
      if (data.usageMetadata) {
        console.log('\n📊 使用量:');
        console.log(`- 入力トークン: ${data.usageMetadata.promptTokenCount}`);
        console.log(`- 出力トークン: ${data.usageMetadata.candidatesTokenCount}`);
        console.log(`- 合計トークン: ${data.usageMetadata.totalTokenCount}`);
      }
    }
    
  } catch (error) {
    console.log('❌ テストエラー:', error.message);
  }
}

testTimetableGeneration();