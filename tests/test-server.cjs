/**
 * 認証テスト用シンプルHTTPサーバー
 * Node.jsの基本機能のみ使用
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3002;

// Auth0設定
const AUTH0_CONFIG = {
  domain: 'school-timetable.jp.auth0.com',
  audience: 'https://api.school-timetable.app',
  clientId: 'YmQjwwCNctZZpYm93DDVWUxAV5Hbpkja',
  nodeEnv: 'development'
};

// CORS設定
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// JSON レスポンス送信
function sendJson(res, data, statusCode = 200) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

// リクエストボディの取得
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  console.log(`${method} ${pathname}`);

  // CORS preflight
  if (method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // 基本テスト
    if (pathname === '/api/test' && method === 'GET') {
      sendJson(res, {
        success: true,
        message: 'Simple auth test server is running',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Auth0設定状態確認
    if (pathname === '/api/auth/status' && method === 'GET') {
      sendJson(res, {
        success: true,
        data: {
          isConfigured: true,
          domain: AUTH0_CONFIG.domain,
          audience: AUTH0_CONFIG.audience,
          clientId: AUTH0_CONFIG.clientId.substring(0, 8) + '...',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Auth0設定情報取得
    if (pathname === '/api/auth/config' && method === 'GET') {
      sendJson(res, {
        success: true,
        data: {
          domain: AUTH0_CONFIG.domain,
          audience: AUTH0_CONFIG.audience,
          clientId: AUTH0_CONFIG.clientId,
          configured: true
        }
      });
      return;
    }

    // モックトークン生成
    if (pathname === '/api/auth/mock/token' && method === 'POST') {
      sendJson(res, {
        success: true,
        data: {
          token: 'mock',
          user: {
            id: 'auth0|mock-user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'school_admin',
            schoolId: 'school-1'
          },
          note: 'This is a mock token for development only. Use "Bearer mock" in Authorization header.'
        }
      });
      return;
    }

    // カスタムモックユーザー生成
    if (pathname === '/api/auth/mock/user' && method === 'POST') {
      const body = await getRequestBody(req);
      const {
        email = 'test@example.com',
        name = 'Test User',
        role = 'school_admin',
        schoolId = 'school-1',
        permissions = []
      } = body;

      sendJson(res, {
        success: true,
        data: {
          token: 'mock',
          user: {
            id: 'auth0|mock-user-123',
            email,
            name,
            role,
            schoolId,
            permissions
          },
          note: 'Custom mock user created for development. Use "Bearer mock" in Authorization header.'
        }
      });
      return;
    }

    // ユーザー情報取得
    if (pathname === '/api/auth/user/me' && method === 'GET') {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        sendJson(res, {
          success: false,
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Authorization header with Bearer token is required'
        }, 401);
        return;
      }

      const token = authHeader.replace('Bearer ', '');
      
      // モックトークンの処理
      if (token === 'mock') {
        sendJson(res, {
          success: true,
          data: {
            user: {
              id: 'auth0|mock-user-123',
              email: 'test@example.com',
              email_verified: true,
              name: 'Test User',
              picture: 'https://example.com/avatar.jpg'
            },
            auth: {
              role: 'school_admin',
              schoolId: 'school-1',
              permissions: ['schools:read', 'schools:write', 'timetables:generate']
            },
            metadata: {
              role: 'school_admin',
              schoolId: 'school-1'
            }
          }
        });
        return;
      }

      // 実際のJWTトークンの処理
      try {
        const parts = token.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid JWT format');
        }

        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        const customMetadata = payload['https://school-timetable.app/user_metadata'] || {};
        
        sendJson(res, {
          success: true,
          data: {
            user: {
              id: payload.sub,
              email: payload.email || 'unknown@example.com',
              email_verified: payload.email_verified || false,
              name: payload.name || payload.email || 'Unknown User',
              picture: payload.picture || 'https://example.com/default-avatar.jpg'
            },
            auth: {
              role: customMetadata.role || 'viewer',
              schoolId: customMetadata.schoolId,
              permissions: customMetadata.permissions || []
            },
            metadata: customMetadata,
            rawPayload: payload // デバッグ用
          }
        });
        return;

      } catch (error) {
        sendJson(res, {
          success: false,
          error: 'AUTHENTICATION_FAILED',
          message: `Token verification failed: ${error.message}`
        }, 401);
        return;
      }
    }

    // JWT検証
    if (pathname === '/api/auth/verify' && method === 'POST') {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        sendJson(res, {
          success: false,
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Authorization header with Bearer token is required'
        }, 401);
        return;
      }

      const token = authHeader.replace('Bearer ', '');
      
      // モックトークンの処理
      if (token === 'mock') {
        sendJson(res, {
          success: true,
          data: {
            valid: true,
            user: {
              id: 'auth0|mock-user-123',
              email: 'test@example.com',
              role: 'school_admin'
            },
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            issued: new Date().toISOString()
          }
        });
        return;
      }

      // 実際のJWTトークンの処理（簡易検証）
      try {
        // JWTの基本構造をチェック
        const parts = token.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid JWT format');
        }

        // ペイロードをデコード
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        // 基本的な検証
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
          throw new Error('Token expired');
        }

        if (payload.iss !== `https://${AUTH0_CONFIG.domain}/`) {
          throw new Error('Invalid issuer');
        }

        if (!payload.aud || !payload.aud.includes(AUTH0_CONFIG.audience)) {
          throw new Error('Invalid audience');
        }

        // カスタムクレームからユーザー情報を抽出
        const customMetadata = payload['https://school-timetable.app/user_metadata'] || {};
        
        sendJson(res, {
          success: true,
          data: {
            valid: true,
            user: {
              id: payload.sub,
              email: payload.email || 'unknown@example.com',
              role: customMetadata.role || 'viewer'
            },
            schoolId: customMetadata.schoolId,
            permissions: customMetadata.permissions || [],
            expires: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
            issued: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
            payload: payload // デバッグ用
          }
        });
        return;

      } catch (error) {
        sendJson(res, {
          success: false,
          error: 'AUTHENTICATION_FAILED',
          message: `Token verification failed: ${error.message}`
        }, 401);
        return;
      }
    }

    // ユーザー権限一覧
    if (pathname === '/api/auth/user/permissions' && method === 'GET') {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        sendJson(res, {
          success: false,
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Authorization header with Bearer token is required'
        }, 401);
        return;
      }

      const token = authHeader.replace('Bearer ', '');
      
      if (token === 'mock') {
        sendJson(res, {
          success: true,
          data: {
            role: 'school_admin',
            schoolId: 'school-1',
            permissions: [
              'schools:read', 'schools:write',
              'classes:read', 'classes:write',
              'teachers:read', 'teachers:write',
              'subjects:read', 'subjects:write',
              'timetables:read', 'timetables:write', 'timetables:generate'
            ],
            effectivePermissions: {
              isUnlimited: false,
              explicitPermissions: [],
              roleBasedPermissions: [
                'schools:read', 'schools:write',
                'timetables:read', 'timetables:write', 'timetables:generate'
              ]
            }
          }
        });
        return;
      }

      sendJson(res, {
        success: false,
        error: 'AUTHENTICATION_FAILED',
        message: 'Token verification failed'
      }, 401);
      return;
    }

    // Auth0コールバック処理
    if (pathname === '/callback' && method === 'GET') {
      setCorsHeaders(res);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Auth0 コールバック</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
            .success { color: #28a745; }
            .token { background: #f8f9fa; padding: 20px; margin: 20px; border-radius: 5px; word-break: break-all; }
          </style>
        </head>
        <body>
          <h1 class="success">🎉 Auth0ログイン成功！</h1>
          <p>アクセストークンを取得しました。</p>
          <div id="tokenDisplay" class="token"></div>
          <button onclick="copyToken()">トークンをコピー</button>
          <button onclick="window.close()">閉じる</button>
          
          <script>
            // URLフラグメントからアクセストークンを取得
            const hash = window.location.hash;
            let token = null;
            
            if (hash.includes('access_token=')) {
              const tokenMatch = hash.match(/access_token=([^&]+)/);
              if (tokenMatch) {
                token = tokenMatch[1];
                document.getElementById('tokenDisplay').innerHTML = 
                  '<strong>アクセストークン:</strong><br>' + token.substring(0, 100) + '...';
                
                // 親ウィンドウにトークンを送信（可能な場合）
                if (window.opener) {
                  try {
                    window.opener.postMessage({ 
                      type: 'auth0_token', 
                      token: token 
                    }, '*');
                  } catch (e) {
                    console.log('親ウィンドウへの送信に失敗:', e);
                  }
                }
              }
            }
            
            if (!token) {
              document.getElementById('tokenDisplay').innerHTML = 
                '<strong style="color: red;">トークンが見つかりません</strong>';
            }
            
            function copyToken() {
              if (token) {
                navigator.clipboard.writeText(token).then(() => {
                  alert('トークンをクリップボードにコピーしました！');
                });
              }
            }
          </script>
        </body>
        </html>
      `);
      return;
    }

    // 静的ファイル配信
    if (pathname === '/test-auth.html' || pathname === '/test-auth-fixed.html' || pathname === '/') {
      let filePath;
      if (pathname === '/') {
        filePath = './test-auth-fixed.html';
      } else if (pathname === '/test-auth.html') {
        filePath = './test-auth-fixed.html'; // 古いURLを新しいファイルにリダイレクト
      } else {
        filePath = '.' + pathname;
      }
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        setCorsHeaders(res);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      }
    }

    // 404
    sendJson(res, {
      success: false,
      error: 'NOT_FOUND',
      message: `Endpoint not found: ${method} ${pathname}`
    }, 404);

  } catch (error) {
    console.error('Server error:', error);
    sendJson(res, {
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`🔐 Auth test server running on http://localhost:${PORT}`);
  console.log(`📝 Test page: http://localhost:${PORT}/test-auth.html`);
  console.log('');
  console.log('📋 Available endpoints:');
  console.log('  GET  /api/test - Basic test');
  console.log('  GET  /api/auth/status - Auth0 status');
  console.log('  GET  /api/auth/config - Auth0 config');
  console.log('  POST /api/auth/mock/token - Mock token');
  console.log('  GET  /api/auth/user/me - User info');
  console.log('  POST /api/auth/verify - JWT verify');
  console.log('  GET  /api/auth/user/permissions - User permissions');
});