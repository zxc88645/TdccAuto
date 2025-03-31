// ==UserScript==
// @name         電子投票自動投票
// @namespace    https://github.com/zxc88645/TdccAuto
// @version      1.6.1
// @description  自動電子投票，並且快速將結果保存成 JPG
// @author       Owen
// @match        https://stockservices.tdcc.com.tw/*
// @icon         https://raw.githubusercontent.com/zxc88645/TdccAuto/refs/heads/main/img/TdccAuto_icon.png
// @grant        GM_getValue
// @grant        GM_setValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// @license      MIT
// @homepage     https://github.com/zxc88645/TdccAuto
// ==/UserScript==

/* global html2pdf */

(function () {
    'use strict';

    const savedKey = 'savedStocks';
    const savedStocks = GM_getValue(savedKey, []);

    // log 當前 savedStocks
    console.log(`[已保存的股票] ${savedStocks.join(', ')}`);

    /** 延遲函式 */
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    /**
     * 查詢 DOM 元素，支援 CSS 選擇器與 XPath
     * @param {string} selector - CSS 選擇器或 XPath
     * @param {Element} [context=document] - 查詢範圍
     * @returns {Element|null} - 匹配的 DOM 元素
     */
    function querySelector(selector, context = document) {
        return selector.startsWith('/') || selector.startsWith('(') ? document.evaluate(selector, context, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
            : context.querySelector(selector);
    }

    /**
     * 點擊指定元素並等待執行完成
     * @param {string} selector - CSS 選擇器或 XPath
     * @param {string} [expectedText=null] - 預期的文字內容
     * @param {string} [logInfo=null] - 日誌輸出標籤
     */
    async function clickAndWait(selector, expectedText = null, logInfo = null) {
        try {
            const element = querySelector(selector);
            if (!element) {
                console.warn(`[未找到] ${selector}`);
                return;
            }

            if (expectedText && element.innerText.trim() !== expectedText) {
                console.warn(`[文字不匹配] 預期: '${expectedText}'，但實際為: '${element.innerText.trim()}'`);
                return;
            }

            console.log(`[點擊] ${selector} ${logInfo ? `| ${logInfo}` : ''}`);
            element.click();
            await sleep(100);
        } catch (error) {
            console.error(`[錯誤] 點擊失敗: ${selector}`, error);
        }
    }

    /**
     * 下載 JPG
     */
    function saveAsJPG() {
        const element = document.querySelector("body > div.c-main > form");
        if (!element) return;

        const children = Array.from(element.children).slice(0, 4);
        const tempDiv = document.createElement("div");
        tempDiv.style.background = "white"; // 確保背景是白的
        children.forEach(el => tempDiv.appendChild(el.cloneNode(true)));

        // 把 tempDiv 暫時加到 body 中，讓 html2canvas 能正確渲染
        document.body.appendChild(tempDiv);
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';

        // 提取股票代號
        const stockNumber = getStockNumber() ?? "投票結果";

        html2canvas(tempDiv, { scale: 2, useCORS: true }).then(canvas => {
            const link = document.createElement("a");
            link.href = canvas.toDataURL("image/jpeg", 1.0);
            link.download = `${stockNumber}.jpg`;
            link.click();
            document.body.removeChild(tempDiv); // 清除暫時元素
        });

        // 保存股票代號
        saveStockNumber();
    }

    /**
     * 保存已下載截圖的代號
     */
    function saveStockNumber() {
        const stockNumber = getStockNumber();
        if (stockNumber) {
            console.log(`[保存] ${stockNumber}`);
            savedStocks.push(stockNumber);
            GM_setValue(savedKey, savedStocks);
        }
    }


    /**
     * 取得股票代號
     */
    function getStockNumber() {
        const text = document.querySelector("body > div.c-main > form > div.c-votelist_title > h2")?.innerText.trim();
        const match = text?.match(/貴股東對(\d+)\s/);
        return match ? match[1] : null;
    }

    /**
     * 標註已儲存的股票代號
     */
    function markSavedStockRows(savedStockList = []) {
        const stockRows = document.querySelectorAll('#stockInfo tbody tr');

        stockRows.forEach(row => {
            const stockCodeCell = row.querySelector('div.u-width--40');
            const appendTargetCell = row.querySelector('td.u-width--20');
            if (!stockCodeCell || !appendTargetCell) return;

            const stockCode = stockCodeCell.textContent.trim();

            if (savedStockList.includes(stockCode)) {
                const alreadyTagged = stockCodeCell.innerHTML.includes('已保存');
                if (!alreadyTagged) {
                    const savedTag = document.createElement('span');
                    savedTag.textContent = '（已保存）';
                    savedTag.className = 'savedTag';
                    savedTag.style.color = 'green';
                    savedTag.style.marginLeft = '5px';
                    savedTag.style.fontSize = '7px';
                    appendTargetCell.appendChild(savedTag);
                }
            }
        });
    }


    /**
     * 主程式
     */
    async function main() {
        const currentPath = window.location.pathname;
        console.log(`[當前網址] ${currentPath}`);

        if (currentPath.includes('/evote/shareholder/001/6_01.html')) {
            console.log('進行電子投票 - 最後的確認');
            await clickAndWait('#go', '確認', '確認');
        } else if (currentPath.includes('/evote/shareholder/001/5_01.html')) {
            // 確認投票結果
            console.log('進行電子投票 - 投票確認');
            await sleep(500);
            await clickAndWait('body > div.c-main > form > div.c-votelist_actions > button:nth-child(1)', '確認投票結果', '確認投票結果');
        } else if (currentPath.includes('/evote/shareholder/001/')) {
            console.log('進行電子投票 - 投票中');

            // 全部棄權
            await clickAndWait('body > div.c-main > form > table:nth-child(3) > tbody > tr.u-t_align--right > td:nth-child(2) > a:nth-child(3)', '全部棄權', '勾選全部棄權(1)');
            await clickAndWait('body > div.c-main > form > div.c-votelist_actions > button:nth-child(2)', '下一步', '按下 下一步(1)');

            // 全部棄權 2
            await clickAndWait('#voteform > table:nth-child(5) > tbody > tr > td.u-t_align--right > a:nth-child(8)', '全部棄權', '勾選全部棄權(2)');
            await clickAndWait('#voteform > div.c-votelist_actions > button:nth-child(1)', '下一步', '按下 下一步(2)');
            await clickAndWait('body > div.jquery-modal.blocker.current > div > div:nth-child(2) > button:nth-child(1)', '下一步', '按下 下一步(2.2)');

        } else if (currentPath === '/evote/shareholder/000/tc_estock_welshas.html') {
            console.log('位於投票列表首頁');
            await clickAndWait('//*[@id="stockInfo"]/tbody/tr[1]/td[4]/a[1]', '投票', '進入投票');

            // 標註已儲存的股票
            markSavedStockRows(savedStocks);
        } else if (currentPath === '/evote/shareholder/002/01.html') {
            console.log('準備列印投票結果');
            if (document.querySelector("#printPage")?.innerText.trim() === '列印') {
                saveAsJPG();
            }

        } else {
            console.warn('當前網址不在預期範圍內');
        }

        console.log('✅ 完成');
    }

    // 在網頁完全載入後執行 main 函式
    window.addEventListener("load", () => setTimeout(main, 500));
})();
