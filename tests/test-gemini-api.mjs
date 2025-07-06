/**
 * Gemini API接続テスト
 * APIキーの動作確認とレスポンステスト
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testGeminiAPI() {
  try {
    // wrangler.jsoncを読み込み
    const wranglerConfigText = fs.readFileSync(path.join(__dirname, 'wrangler.jsonc'), 'utf8');
    // JSONCのコメントを除去
    const cleanJson = wranglerConfigText.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const wranglerConfig = JSON.parse(cleanJson);
    
    const apiKey = wranglerConfig.vars?.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.log('❌ GEMINI_API_KEY が設定されていません');
      return;
    }
    
    console.log('✅ APIキーが設定されています');
    console.log('🔄 Gemini APIテスト中...\n');
    
    // Gemini APIにテストリクエスト
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
                text: 'こんにちは。簡単な挨拶をJSON形式で返してください。例: {"message": "こんにちは", "status": "success"}'
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 100
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log('❌ Gemini APIエラー:', errorData);
      return;
    }

    const data = await response.json();
    console.log('✅ Gemini API接続成功！');
    console.log('📝 レスポンス:');
    
    if (data.candidates && data.candidates[0]) {
      const generatedText = data.candidates[0].content.parts
        .map(part => part.text)
        .join('');
      
      console.log(generatedText);
      console.log('\n🎉 Gemini 2.5 Proが正常に動作しています！');
      
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

testGeminiAPI();