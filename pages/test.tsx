import React, { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const InnerTestPage = dynamic(async () => {
  const faceMesh = await import('@mediapipe/face_mesh');
  const camera = await import('@mediapipe/camera_utils');
  const drawing = await import('@mediapipe/drawing_utils');
  const FaceMesh = faceMesh.FaceMesh;
  const Camera = camera.Camera;
  return () => {
    const cvs = useRef<HTMLCanvasElement>();
    const vid = useRef<HTMLVideoElement>();

    const width = 1280;
    const height = 720;

    useEffect(() => {
      const canvas = cvs.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'green';
      // ctx.fillRect(10, 10, 150, 100);
      ctx.fillRect(0, 0, 10000, 10000);

      // window.addEventListener('resize', (e) => {
      //   canvas.width = window.innerWidth;
      //   canvas.height = window.innerHeight;
      // })
  
      const video = vid.current;
  
      const k = new FaceMesh({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`});

      const promptStat = {
        prompt: undefined,
        repeatInterval: 3000, // 3s
        startInterval: 750,  // 0.75s
        timeout: null,
        utterance: null,
        timer: () => {
          clearTimeout(promptStat.timeout);
          promptStat.timeout = null;
          console.log(promptStat.prompt);

          if(promptStat.utterance === null) {
            return;
          }

          speechSynthesis.speak(promptStat.utterance);

          promptStat.timeout = setTimeout(promptStat.timer, promptStat.repeatInterval);
        },
        setPrompt: (v?: string) => {
          if(v === undefined) {
            promptStat.utterance = null;
            if(promptStat.timeout) {
              clearTimeout(promptStat.timeout);
            }
          } else {
            if(v !== promptStat.prompt) {
              promptStat.utterance = new SpeechSynthesisUtterance(v);
              if(promptStat.timeout) {
                clearTimeout(promptStat.timeout);
              }
              setTimeout(promptStat.timer, promptStat.startInterval);
            }
          }
          promptStat.prompt = v;
        },
        stop: () => {
          if(promptStat.timeout) {
            clearTimeout(promptStat.timeout);
          }
        }
      };
  
      k.setOptions({
        maxNumFaces: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      k.onResults((results) => {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        const headPos = [];
        if (results.multiFaceLandmarks) {
          for (const landmarks of results.multiFaceLandmarks) {
            drawing.drawConnectors(ctx, landmarks, faceMesh.FACEMESH_TESSELATION, {color: '#C0C0C070', lineWidth: 1});
            drawing.drawConnectors(ctx, landmarks, faceMesh.FACEMESH_RIGHT_EYE, {color: '#FF3030'});
            drawing.drawConnectors(ctx, landmarks, faceMesh.FACEMESH_RIGHT_EYEBROW, {color: '#FF3030'});
            drawing.drawConnectors(ctx, landmarks, faceMesh.FACEMESH_LEFT_EYE, {color: '#30FF30'});
            drawing.drawConnectors(ctx, landmarks, faceMesh.FACEMESH_LEFT_EYEBROW, {color: '#30FF30'});
            drawing.drawConnectors(ctx, landmarks, faceMesh.FACEMESH_FACE_OVAL, {color: '#E0E0E0'});
            drawing.drawConnectors(ctx, landmarks, faceMesh.FACEMESH_LIPS, {color: '#E0E0E0'});
            const centroid = faceMesh.FACEMESH_FACE_OVAL
              .flatMap(v => [ landmarks[v[0]], landmarks[v[1]] ])
              .reduce((p, v) => [p[0] + v.x, p[1] + v.y, p[2] + v.z], [0, 0, 0])
              .map(v => v / (faceMesh.FACEMESH_FACE_OVAL.length * 2));
            // console.log(centroid);
            drawing.drawConnectors(ctx, landmarks, [[454, 4], [4, 234]], {color: '#000000'});

            const faceVectorNode = [4, 454, 234].map(v => landmarks[v]);
            const faceCentroid = ['x', 'y', 'z'].map(k => (faceVectorNode[1][k] + faceVectorNode[2][k]) * 0.5)
            const faceForward = ['x', 'y', 'z'].map(k => faceVectorNode[0][k] - (faceVectorNode[1][k] + faceVectorNode[2][k]) * 0.5)
            const faceSize = Math.sqrt(['x', 'y', 'z'].map(k => faceVectorNode[1][k] - faceVectorNode[2][k]).reduce((p, v) => p += v * v, 0));
            // const vecA = ['x', 'y', 'z'].map(k => faceVectorNode[1][k] - faceVectorNode[0][k])
            // const vecB = ['x', 'y', 'z'].map(k => faceVectorNode[2][k] - faceVectorNode[0][k])
            headPos.push([faceCentroid, faceForward, faceSize]);
          }
        }
        if(headPos.length === 1) {
          const [faceCentroid, faceForward, faceSize] = headPos[0];
          console.log(faceSize);
          if(faceSize > 0.4) {
            promptStat.setPrompt('Move your phone farther');
          } else if(faceSize < 0.25) {
            promptStat.setPrompt('Move your phone closer');
          } else if(faceCentroid[0] < 0.3) {
            promptStat.setPrompt('Twist your phone right');
          } else if(faceCentroid[0] > 0.7) {
            promptStat.setPrompt('Twist your phone left');
          } else if(faceCentroid[1] < 0.3) {
            promptStat.setPrompt('Twist your phone upwards');
          } else if(faceCentroid[1] > 0.7) {
            promptStat.setPrompt('Twist your phone downwards');
          } else {
            promptStat.setPrompt();
          }
        } else {
          promptStat.setPrompt('Cannot detect your face currently');
        }
        ctx.restore();
      });
  
      const cam = new Camera(video, {
        onFrame: async () => {
          await k.send({image: video});
        },
        width, height,
      });
      cam.start();

      return () => {
        promptStat.stop();
      }
    }, [cvs]);
    return (<>
      <video ref={vid} style={{display: 'none'}}></video>
      <canvas ref={cvs} width={width} height={height} />
    </>);
  }
}, {
  ssr: false
});

export default function TestPage() {
  return (<>
    <h1>测试</h1>
    <InnerTestPage />
  </>);
}