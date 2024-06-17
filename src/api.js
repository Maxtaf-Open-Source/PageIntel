// api.js

export function fetchOpenAI(model, messages, apiKey, apiUrl) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return fetch(apiUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0
    })
  })
  .then(response => {
    return response.json().then(data => {
      if (!response.ok) {
        // Include more specific error data if available
        const errorDetail = data.error ? `${data.error.message}` : response.statusText;
        throw new Error(`API Error: ${errorDetail}`);
      }
      return {
        result: data.choices[0].message.content,
        usage: data.usage
      };
    });
  })
  .catch(error => {
    console.log('Fetch operation error:', error);
    throw error; // Re-throw to ensure it can be caught by the caller
  });
}