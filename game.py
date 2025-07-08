import random
from flask import Flask, render_template, request, session, redirect, url_for

app = Flask(__name__)
# !! 重要：請將 'your_super_secret_key' 替換為一個複雜且隨機的字串 !!
# 建議使用 Python 產生：import os; print(os.urandom(24))
app.secret_key = '請替換為一個真正隨機且複雜的字串'

@app.route('/', methods=['GET', 'POST'])
def index():
    # 如果 session 中沒有 secret_number，表示是新遊戲或首次進入
    if 'secret_number' not in session:
        session['secret_number'] = random.randint(1, 100) # 生成 1 到 100 的隨機數
        session['guesses_taken'] = 0 # 初始化猜測次數
        session['message'] = '我心裡想了一個 1 到 100 之間的數字。你來猜猜看！'
        session['game_over'] = False # 遊戲是否結束的標誌

    message = session['message']
    game_over = session['game_over']
    result = None # 記錄遊戲結果 (贏或輸)，用於在 HTML 中顯示不同樣式

    # 如果是 POST 請求 (玩家提交了猜測) 且遊戲未結束
    if request.method == 'POST' and not game_over:
        try:
            player_guess = int(request.form['guess']) # 獲取玩家猜測的數字
            session['guesses_taken'] += 1 # 猜測次數加一

            if player_guess == session['secret_number']:
                # 猜對了
                session['message'] = f'恭喜你！你猜對了！這個數字就是 {session["secret_number"]}。你用了 {session["guesses_taken"]} 次就猜中了！'
                session['game_over'] = True
                result = 'win'
            elif player_guess < session['secret_number']:
                # 猜低了
                session['message'] = '太低了！'
            else:
                # 猜高了
                session['message'] = '太高了！'

            # 如果猜測次數達到上限且尚未猜對
            if session['guesses_taken'] >= 7 and not session['game_over']:
                session['message'] = f'遊戲結束！你已經猜了 7 次。正確答案是 {session["secret_number"]}。'
                session['game_over'] = True
                result = 'lose'

        except ValueError:
            # 處理非數字輸入
            session['message'] = '請輸入一個有效的數字！'

    # 渲染 HTML 模板，並傳遞遊戲狀態資料
    return render_template('index.html',
                           message=session['message'],
                           guesses_taken=session['guesses_taken'],
                           game_over=session['game_over'],
                           result=result)

# 重置遊戲的路由
@app.route('/reset')
def reset_game():
    # 從 session 中移除所有遊戲相關的數據，重新開始
    session.pop('secret_number', None)
    session.pop('guesses_taken', None)
    session.pop('message', None)
    session.pop('game_over', None)
    return redirect(url_for('index')) # 重定向回主頁

if __name__ == '__main__':
    # 在本地運行時使用 debug 模式，部署到 Render 時會由 Gunicorn 管理
    app.run(debug=True)