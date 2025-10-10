// /api/webhook.js

// 这是一个 Vercel Serverless Function 模板
export default async function handler(req, res) {
  // --- 安全性检查 (可选但推荐) ---
  // 确保请求是 POST 方法
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // --- 1. 从 GitLab 接收并解析数据 ---
  const gitlabPayload = req.body;

  try {
    // --- 2. 提取你需要的信息 ---
    // 这里我们提取之前讨论过的关键信息
    const updaterName = gitlabPayload.user_name || '未知用户';
    const projectName = gitlabPayload.project ? gitlabPayload.project.name : '未知项目';
    
    // 安全地获取提交信息和文件列表
    const latestCommit = gitlabPayload.commits && gitlabPayload.commits[0] ? gitlabPayload.commits[0] : {};
    const commitMessage = latestCommit.message || '没有提交信息';
    const modifiedFiles = latestCommit.modified || [];
    const addedFiles = latestCommit.added || [];

    // --- 3. 转换成你的工作流产品要求的格式 ---
    // !!! 这是最关键的一步，你需要根据你的产品 API 文档来构建这个对象 !!!
    // 假设你的工作流产品需要这样的格式：
    // { "event_source": "gitlab", "user": "张三", "details": "...", "files_changed": [...] }
    const workflowPayload = {
      event_source: "gitlab-prd-update",
      user: updaterName,
      project: projectName,
      details: commitMessage, // 将提交信息作为详情
      files_changed: [...addedFiles, ...modifiedFiles] // 合并新增和修改的文件列表
    };

    // --- 4. 调用你的工作流产品的 API ---
    const workflowApiUrl = 'https://insight-api.airdroid.com/api/v1/workflow/exe/k1B...'; // 换成你真正的 API 地址

    const response = await fetch(workflowApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 如果你的 API 需要密钥认证，在这里添加
        // 'Authorization': 'Bearer YOUR_API_KEY' 
      },
      body: JSON.stringify(workflowPayload)
    });

    // 检查调用是否成功
    if (!response.ok) {
      // 如果调用失败，记录错误并返回给 GitLab 一个错误状态
      const errorText = await response.text();
      console.error('Failed to call workflow API:', errorText);
      return res.status(502).json({ message: 'Failed to trigger workflow', error: errorText });
    }

    // --- 成功响应 ---
    // 向 GitLab 返回一个成功的响应，表示我们已经收到并处理了
    res.status(200).json({ message: 'Webhook received and workflow triggered successfully!' });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
