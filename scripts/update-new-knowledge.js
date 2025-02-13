const axios = require('axios');
const fs = require('fs');

// 定义目标 URL 和输出文件
const url = 'https://www.odaily.news/v1/openapi/feeds_en';
const characterFile = 'characters/aivinci.character.json';

// 下载并解析数据
async function fetchAndFormatData() {

    const characterData = JSON.parse(fs.readFileSync(characterFile, 'utf8'));

    try {
        // 发起 HTTP 请求获取 JSON 数据
        const response = await axios.get(url);
        const data = response.data;
        // 检查和提取目标字段
        if (data && data.data && Array.isArray(data.data.arr_news)) {
            const formattedData = data.data.arr_news.map(news =>
                `news: ${news.title} - ${news.link}`
            );
            // 过滤掉 knowledge 中以 "odaily news:" 开头的记录
            if (characterData.knowledge && Array.isArray(characterData.knowledge)) {
                characterData.knowledge = characterData.knowledge.filter(
                    item => !item.startsWith('news:')
                );
            }
            // 将 formattedData 写入到 knowledge 中
            characterData.knowledge.push(...formattedData);
            // 写回 character.json 文件
            fs.writeFileSync(characterFile, JSON.stringify(characterData, null, 2), 'utf8');
            console.log(`已成功更新 ${characterFile} 文件`);
        } else {
            console.error('数据格式不正确或 arr_news 为空');
        }
    } catch (error) {
        console.error('获取或解析数据时发生错误:', error.message);
    }
}

// 执行脚本
fetchAndFormatData();
