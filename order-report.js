// ==UserScript==
// @name         淘宝买家订单导出插件
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  基于-淘宝买家订单导出这个插件做了一些拓展（Todo:导出前一天的订单数据, Todo:定时导出前一天的数据）
// @author       kubrick
// @include      https://buyertrade.taobao*
// @require      https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.15/lodash.min.js
// @grant        none
// @license      MIT
// ==/UserScript==
function addButton(element, onclickFunc, value = "按钮", width = "40px", height = "40px") {
    const button = document.createElement("input");
    button.type = "button";
    button.value = value;
    button.style.height = height;
    button.style.width = width;
    button.style.align = "center";
    button.style.marginBottom = "10px";
    button.style.marginLeft = "250px";
    button.style.color = "white";
    button.style.background = "#409EFF";
    button.style.border = "1px solid #409EFF";

    button.onclick = function () {
        onclickFunc();
    }

    element.appendChild(button);
    element.insertBefore(button, element.childNodes[0]);
}

const orderListPage = /(http|https):\/\/buyertrade\.taobao.*?\/trade/g;
const orderTime ="2022-10-12"
if (orderListPage.exec(document.URL)) {
    const orderListMain = document.getElementById("J_bought_main");
    addButton(orderListMain, addCurrentPageOrdersToList, "添加订单", "60px");
    addButton(orderListMain, addCurrentPageOrdersToList, "清除订单", "60px");
    addButton(orderListMain, exportOrders, "导出订单", "60px");
    addButton(orderListMain, addOrdersToReportListV2, "定时导出订单", "80px");
}

// setTimeout
let sleep = function (fun, time) {
    setTimeout(() => {
        fun();
    }, time);
}

let flag = true
// 添加订单到导出列表
function addOrdersToReportListV2() {

    // 1、循环所有的页面订单，小于指定日期直接进行返回
    // 2、先获取当前页面的，有下一页就获取下一页，直到没有下一页。
    get_next_page_order()

    while (flag) {
        document.getElementsByClassName("pagination-next")[0].click();
        // 延迟执行
        sleep(get_next_page_order, 2000);
    }
    console.info("添加订单成功!")
}
// 跳转到下一页(需要递归)
function get_next_page_order() {

    const orders = document.getElementsByClassName("js-order-container");
    if (orders == null || orders == undefined) {
        return
    }
    for (let order of orders) {
        let items = processOrder(order);
        if (!items) {
            continue;
        }
        _.forEach(items, (value, key) => {
            orderList[key] = value;
        })
    }
    console.info(orderList)
}

// 导出csv
function toCsv(header, data, filename) {
    let rows = "";
    let row = header.join(",");
    rows += row + "\n";

    _.forEach(data, value => {
        rows += _.replace(value.join(","), '#', '@') + "\n";
    })

    let blob = new Blob(["\ufeff" + rows], { type: 'text/csv;charset=utf-8;' });
    let encodedUrl = URL.createObjectURL(blob);
    let url = document.createElement("a");
    url.setAttribute("href", encodedUrl);
    url.setAttribute("download", filename + ".csv");
    document.body.appendChild(url);
    url.click();
}

let orderList = {}
// 添加当前页面的订单到导出列表
function addCurrentPageOrdersToList() {
    const orders = document.getElementsByClassName("js-order-container");

    for (let order of orders) {

        let items = processOrder(order);

        if (!items) {
            continue;
        }

        _.forEach(items, (value, key) => {
            orderList[key] = value;
        })
    }
    console.info("添加订单成功!")
}

function exportOrders() {

    const header = ["订单号", "下单日期", "商品明细", "商品链接", "单价", "数量", "实付款", "状态"];

    toCsv(header, orderList, "淘宝订单导出")
}


function processOrder(order) {

    let outputData = {};
    let textContent = order.textContent;
    let pattern = /(\d{4}-\d{2}-\d{2})订单号: ()/;
    let isExist = pattern.exec(textContent);
    let insuranceText = "保险服务";

    if (!isExist) {
        console.log('暂未发现订单！');
    } else {
        const date = isExist[1];
        console.info("订单时间:" + date)

        const id = order.querySelector("div[data-id]").getAttribute("data-id");

        let index = 0;

        if (date != orderTime) {
            return;
        }
        if (date < orderTime) {
            console.info("time is end!")
            flag = false
            return
        }
        let productQuery = order.querySelector("span[data-reactid='.0.7:$order-" + id + ".$" + id + ".0.1:1:0.$" + index + ".$0.0.1.0.0.1']");
        let priceQuery = order.querySelector("span[data-reactid='.0.7:$order-" + id + ".$" + id + ".0.1:1:0.$" + index + ".$1.0.1.1']");
        let countQuery = order.querySelector("p[data-reactid='.0.7:$order-" + id + ".$" + id + ".0.1:1:0.$" + index + ".$2.0.0']");
        let actualPayQuery = order.querySelector("span[data-reactid='.0.7:$order-" + id + ".$" + id + ".0.1:1:0.$" + index + ".$4.0.0.2.0.1']");
        let itemUrlQuery = order.querySelector("a[href]");

        if (productQuery === null) {
            return;
        }

        let price = priceQuery.textContent;
        if (productQuery.textContent == insuranceText) {
            return;
        }

        let count = countQuery.textContent;
        let actualPay;
        if (actualPayQuery != null) {
            // 实付金额
            actualPay = actualPayQuery.textContent;
        } else {
            count = 1;
        }

        if (index === 0) {
            let statusQuery = order.querySelector("span[data-reactid='.0.7:$order-" + id + ".$" + id + ".0.1:1:0.$" + index + ".$5.0.0.0']");
            // 订单状态
            let orderStatus = statusQuery.textContent;
            console.info(orderStatus)
        }

        let itemUrl = itemUrlQuery.href

        index++;

        outputData[id + index] = [
            id,
            date,
            productQuery.textContent.replace(/,/g, "，"),
            itemUrl,
            parseFloat(price),
            count,
            actualPay,
            status,
        ]
    }
    return outputData;
}
