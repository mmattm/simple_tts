require("dotenv").config();

const fs = require("fs/promises");

const express = require("express");
var bodyParser = require("body-parser");

const cors = require("cors");
const _ = require("lodash");
const { v4: uuid } = require("uuid");
var bodyParser = require("body-parser");
const fetch = require("node-fetch");

const app = express();

const PORT = process.env.PORT || 9000;

var jsonParser = bodyParser.json();
var urlencodedParser = bodyParser.urlencoded({ extended: false });

app.use(cors());

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

const textToSpeech = require("@google-cloud/text-to-speech");
const client = new textToSpeech.TextToSpeechClient();

app.post("/gpt", jsonParser, async (req, res) => {
  //const request = JSON.parse(req.body);
  //console.log(req.body.image);
  let finalAnswer = "";
  let prediction = undefined;

  if (req.body.image) {
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version:
          "4b32258c42e9efd4288bb9910bc532a69727f9acd26aa08e175713a0a857a608",

        input: {
          caption: req.body.visualQuestion === "" ? true : false,
          image: req.body.image,
          question: req.body.visualQuestion,
        },
      }),
    });
    //console.log(response);

    if (response.status !== 201) {
      let error = await response.json();
      res.statusCode = 500;
      console.log(JSON.stringify({ detail: error.detail }));

      res.end(JSON.stringify({ detail: error.detail }));
      return;
    }

    prediction = await response.json();
    res.statusCode = 201;

    let queryCount = 0;
    //console.log(JSON.stringify(prediction));

    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed" &&
      queryCount < 8
    ) {
      console.log("waiting for prediction to finish :" + queryCount + "/ 8");
      queryCount++;
      await sleep(1000);
      const response = await fetch(
        "https://api.replicate.com/v1/predictions/" + prediction.id,
        {
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
      prediction = await response.json();
      if (response.status !== 200) {
        // error
        console.log(prediction);
        return;
      }

      if (prediction.output) {
        console.log("successfully queried prediction");
        console.log(prediction.output);

        if (req.body.systemPrompt) {
          console.log("now asking OpenAI");
          finalAnswer = await callAPI({
            content: prediction.output,
            systemPrompt: req.body.systemPrompt,
          });
          finalAnswer = isJsonString(finalAnswer)
            ? JSON.parse(finalAnswer)
            : finalAnswer;
          console.log("OpenAI answer: " + finalAnswer);
          //getChatGpt();
        } else {
          console.log("No GPT");
        }
      }

      if (prediction == "") {
        console.log("prediction failed");
      }
    }
  } else {
    console.log("No image provided, asking OpenAI only");
    finalAnswer = await callAPI({
      content: req.body.content,
      systemPrompt: req.body.systemPrompt,
    });

    finalAnswer = isJsonString(finalAnswer)
      ? JSON.parse(finalAnswer)
      : finalAnswer;
  }

  //res.end(JSON.stringify(prediction));
  console.log(finalAnswer);
  res.json({
    output: finalAnswer ? JSON.stringify(finalAnswer) : undefined,
    prediction: !prediction ? "No prediction" : prediction,
  });
});

app.post("/gptv2", jsonParser, async (req, res) => {
  //const request = JSON.parse(req.body);
  //console.log(req.body.image);
  let finalAnswer = "";
  let prediction = undefined;

  if (req.body.image) {
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version:
          "4b32258c42e9efd4288bb9910bc532a69727f9acd26aa08e175713a0a857a608",

        input: {
          caption: req.body.visualQuestion === "" ? true : false,
          image: req.body.image,
          question: req.body.visualQuestion,
        },
      }),
    });
    //console.log(response);

    if (response.status !== 201) {
      let error = await response.json();
      res.statusCode = 500;
      console.log(JSON.stringify({ detail: error.detail }));

      res.end(JSON.stringify({ detail: error.detail }));
      return;
    }

    prediction = await response.json();
    res.statusCode = 201;

    let queryCount = 0;
    //console.log(JSON.stringify(prediction));

    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed" &&
      queryCount < 8
    ) {
      console.log("waiting for prediction to finish :" + queryCount + "/ 8");
      queryCount++;
      await sleep(1000);
      const response = await fetch(
        "https://api.replicate.com/v1/predictions/" + prediction.id,
        {
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
      prediction = await response.json();
      if (response.status !== 200) {
        // error
        console.log(prediction);
        return;
      }

      if (prediction.output) {
        console.log("successfully queried prediction");
        console.log(prediction.output);

        if (req.body.systemPrompt) {
          console.log("now asking OpenAI");
          finalAnswer = await callAPIGPT4({
            content: prediction.output,
            systemPrompt: req.body.systemPrompt,
          });
          finalAnswer = isJsonString(finalAnswer)
            ? JSON.parse(finalAnswer)
            : finalAnswer;
          console.log("OpenAI answer: " + finalAnswer);
          //getChatGpt();
        } else {
          console.log("No GPT");
        }
      }

      if (prediction == "") {
        console.log("prediction failed");
      }
    }
  } else {
    console.log("No image provided, asking OpenAI only");
    finalAnswer = await callAPIGPT4({
      content: req.body.content,
      systemPrompt: req.body.systemPrompt,
    });

    finalAnswer = isJsonString(finalAnswer)
      ? JSON.parse(finalAnswer)
      : finalAnswer;
  }

  //res.end(JSON.stringify(prediction));
  console.log(finalAnswer);
  res.json({
    output: finalAnswer ? JSON.stringify(finalAnswer) : undefined,
    prediction: !prediction ? "No prediction" : prediction,
  });
});

app.post("/tts", jsonParser, async (req, res) => {
  if (req.body.text) {
    // The text to synthesize
    console.log("text to synthesize: " + req.body.text);
    const text = req.body.text;

    const requestBody = {
      input: {
        text: req.body.text,
      },
      voice: {
        languageCode: "en-US",
        name: "en-US-Studio-O",
        // ssmlGender: "Male",
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    };

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          // Authorization: `Token AIzaSyBVYukHSXjIeer35wPFTWe4WhfgQ0-eaBE`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    )
      .then((response) => {
        if (!response.ok) {
          //throw new Error("Error calling Google Text-to-Speech API");
          console.log("Error calling Google Text-to-Speech API");
        }
        return response.json();
      })
      .then((responseData) => {
        const audioContent = responseData.audioContent;
        //console.log("Audio content received:");
        //console.log(audioContent);

        res.json({
          audioContent: audioContent,
        });

        // Here, you can save the audioContent to a file or use it as needed
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }
});

app.post("/ocr", jsonParser, async (req, res) => {
  console.log("OCR");
  if (req.body.image) {
    const reqImage = req.body.image.slice(23);
    // Prepare the request payload
    const requestBody = {
      requests: [
        {
          image: {
            content: reqImage,
          },
          features: [
            {
              type: "TEXT_DETECTION",
            },
          ],
        },
      ],
    };

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          // Authorization: `Token AIzaSyBVYukHSXjIeer35wPFTWe4WhfgQ0-eaBE`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    const detections = data.responses[0].textAnnotations;
    // console.log("Text:");
    // detections.forEach((text) => console.log(text));

    if (detections) {
      console.log(detections);
      if (detections[0]) {
        res.json({
          ocr: detections,
        });
      } else {
        console.log("No detections");
        res.json({});
      }
    } else {
      console.log("No detections");
      res.json({});
    }
  } else {
    res.send("No Image");
  }
});

// app.get("/predictions/:id", async (req, res) => {
//   const id = req.params.id;
//   const response = await fetch(
//     "https://api.replicate.com/v1/predictions/" + req.params.id,
//     {
//       headers: {
//         Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
//         "Content-Type": "application/json",
//       },
//     }
//   );
//   if (response.status !== 200) {
//     let error = await response.json();
//     res.statusCode = 500;
//     res.end(JSON.stringify({ detail: error.detail }));
//     return;
//   }

//   const prediction = await response.json();
//   res.end(JSON.stringify(prediction));
// });

const callAPI = async ({ content, systemPrompt }) => {
  const params = {
    model: "gpt-3.5-turbo-0301",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: content,
      },
    ],
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(params),
    });
    const data = await response.json();

    //console.log(data.choices[0].message.content);

    return data.choices[0].message.content;
  } catch (err) {
    console.error(err);
  }
};

const callAPIGPT4 = async ({ content, systemPrompt }) => {
  console.log("callAPI GPT4");
  const params = {
    model: "gpt-4",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: content,
      },
    ],
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAIGPT4_API_KEY}`,
      },
      body: JSON.stringify(params),
    });
    const data = await response.json();

    //console.log(data.choices[0].message.content);

    return data.choices[0].message.content;
  } catch (err) {
    console.error(err);
  }
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

app.get("/", (req, res) => {
  res.send("Hello there! Api is working");
});

//app.use(express.bodyParser({ limit: "50mb" }));

function isJsonString(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

app.listen(PORT, () => console.log(`Sever is running port ${PORT} ...`));
