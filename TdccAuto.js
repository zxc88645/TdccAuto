// ==UserScript==
// @name         電子投票自動投票
// @namespace    https://github.com/zxc88645/TdccAuto
// @version      1.5
// @description  自動電子投票並保存結果成 PDF
// @author       Owen
// @match        https://stockservices.tdcc.com.tw/*
// @icon         https://raw.githubusercontent.com/zxc88645/TdccAuto/refs/heads/main/img/TdccAuto_icon.png
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// @license      MIT
// @homepage     https://github.com/zxc88645/TdccAuto
// @downloadURL  https://update.greasyfork.org/scripts/530187/%E9%9B%BB%E5%AD%90%E6%8A%95%E7%A5%A8%E8%87%AA%E5%8B%95%E6%8A%95%E7%A5%A8.user.js
// @updateURL    https://update.greasyfork.org/scripts/530187/%E9%9B%BB%E5%AD%90%E6%8A%95%E7%A5%A8%E8%87%AA%E5%8B%95%E6%8A%95%E7%A5%A8.meta.js
// ==/UserScript==

/* global html2pdf */

(function () {
    'use strict';

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
     * 下載 PDF
     */
    function savePDF() {
        const element = document.querySelector("body > div.c-main > form");
        if (!element) return;

        const children = Array.from(element.children).slice(0, 4);
        const tempDiv = document.createElement("div");
        children.forEach(el => tempDiv.appendChild(el.cloneNode(true)));

        // 提取股票代號
        const text = document.querySelector("body > div.c-main > form > div.c-votelist_title > h2")?.innerText.trim();
        const match = text?.match(/貴股東對(\d+)\s/);
        const stockNumber = match ? match[1] : "投票結果";

        html2pdf()
            .set({
            margin: 1,
            filename: `${stockNumber}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
            .from(tempDiv)
            .save();
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
        const text = document.querySelector("body > div.c-main > form > div.c-votelist_title > h2")?.innerText.trim();
        const match = text?.match(/貴股東對(\d+)\s/);
        const stockNumber = match ? match[1] : "投票結果";

        html2canvas(tempDiv, { scale: 2, useCORS: true }).then(canvas => {
            const link = document.createElement("a");
            link.href = canvas.toDataURL("image/jpeg", 1.0);
            link.download = `${stockNumber}.jpg`;
            link.click();
            document.body.removeChild(tempDiv); // 清除暫時元素
        });
    }


    /**
     * 主程式
     */
    async function main() {
        const currentPath = window.location.pathname;
        console.log(`[當前網址] ${currentPath}`);

        if (currentPath.includes('/evote/shareholder/001/')) {
            console.log('進行電子投票');

            // 全部棄權
            await clickAndWait('body > div.c-main > form > table:nth-child(3) > tbody > tr.u-t_align--right > td:nth-child(2) > a:nth-child(3)', '全部棄權', '勾選全部棄權(1)');
            await clickAndWait('body > div.c-main > form > div.c-votelist_actions > button:nth-child(2)', '下一步', '按下 下一步(1)');

            // 全部棄權 2
            await clickAndWait('#voteform > table:nth-child(5) > tbody > tr > td.u-t_align--right > a:nth-child(8)', '全部棄權', '勾選全部棄權(2)');
            await clickAndWait('#voteform > div.c-votelist_actions > button:nth-child(1)', '下一步', '按下 下一步(2)');
            await clickAndWait('body > div.jquery-modal.blocker.current > div > div:nth-child(2) > button:nth-child(1)', '下一步', '按下 下一步(2.2)');

            // 確認投票結果
            await clickAndWait('body > div.c-main > form > div.c-votelist_actions > button:nth-child(1)', '確認投票結果', '確認投票結果');


        } else if (currentPath === '/evote/shareholder/000/tc_estock_welshas.html') {
            console.log('位於投票列表首頁');
            await clickAndWait('//*[@id="stockInfo"]/tbody/tr[1]/td[4]/a[1]', '投票', '進入投票');

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
