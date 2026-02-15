export class RecordingManager {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  public isRecording: boolean = false;

  start(canvas: HTMLCanvasElement) {
    this.chunks = [];
    // 60fps capture
    this.stream = canvas.captureStream(60); 
    
    // Prefer VP9 for quality, fallback to defaults
    const mimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm",
        "video/mp4"
    ];
    let selectedType = "";
    for(const t of mimeTypes) {
        if(MediaRecorder.isTypeSupported(t)) {
            selectedType = t;
            break;
        }
    }

    if(!selectedType) {
        console.error("No supported video mime types found");
        return;
    }

    this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: selectedType,
        videoBitsPerSecond: 8000000 // 8 Mbps
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      this.saveFile(selectedType);
    };

    this.mediaRecorder.start();
    this.isRecording = true;
  }

  stop() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  private saveFile(mimeType: string) {
    const blob = new Blob(this.chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style.display = "none";
    a.href = url;
    a.download = `OMNI-FLUX_REC_${Date.now()}.webm`;
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}