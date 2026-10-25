"""Cut actual captured footage into the requested labelled 20-second preview."""
import hashlib
import json
from pathlib import Path
import subprocess

raw=Path('.runtime/SIMULATED_recording')
output=Path('docs/media')
meta=json.loads((output/'SIMULATED_recording.json').read_text())
def duration(path):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(path)],text=True))
close,attack=[raw/f'SIMULATED_{name}.webm' for name in ['close','attack']]
close_seconds=min(duration(close),meta['closeSeconds'])-.4
attack_seconds=min(duration(attack),meta['attackSeconds'])-.4
# Full-page still capture temporarily changes the viewport. Exclude that final
# capture operation; use the recorded pre-screenshot timestamps, with a margin.
click=meta['attackClickSeconds'];speed=(attack_seconds-click)/10
Path('tmp').mkdir(exist_ok=True)
Path('tmp/SIMULATED_caption_close.txt').write_text('SIMULATED / actual local close / idle wait removed')
Path('tmp/SIMULATED_caption_attack.txt').write_text(f'SIMULATED / actual mined attack / {speed:.2f}x time compression')
font='assets/fonts/NotoSans-Regular.ttf'
def caption(stage):return f'drawtext=fontfile={font}:textfile=tmp/SIMULATED_caption_{stage}.txt:fontsize=15:box=1:boxcolor=white@0.96:fontcolor=0x243330:x=10:y=h-th-10'
filters=f'[0:v]trim=start={max(0,close_seconds-10)}:end={close_seconds},setpts=PTS-STARTPTS,scale=960:600,fps=10,{caption("close")}[a];[1:v]trim=start={click}:end={attack_seconds},setpts={(10/(attack_seconds-click))}*(PTS-STARTPTS),scale=960:600,fps=10,{caption("attack")}[b];[a][b]concat=n=2:v=1:a=0[v]'
common=['ffmpeg','-y','-v','warning','-i',str(close),'-i',str(attack)]
mp4=output/'SIMULATED_local_preview_20s.mp4'
gif=output/'SIMULATED_local_preview_20s.gif'
subprocess.run(common+['-filter_complex',filters,'-map','[v]','-an','-t','20','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-metadata','title=SIMULATED local rehearsal; actual protocol execution',str(mp4)],check=True)
subprocess.run(['ffmpeg','-y','-v','warning','-i',str(mp4),'-filter_complex','[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0','-metadata','comment=SIMULATED actual local execution; wait removed and attack time compressed; no public deployment',str(gif)],check=True)
meta.update(previewSeconds=duration(mp4),attackSpeedup=speed,sourceSHA256={str(p):hashlib.file_digest(p.open('rb'),'sha256').hexdigest() for p in [close,attack]},outputSHA256={str(p):hashlib.file_digest(p.open('rb'),'sha256').hexdigest() for p in [mp4,gif]},note='Actual UI and mined local transactions. Close uses the final ten seconds of the capture. Attack sequence compressed to ten seconds with an on-frame label. This is a local rehearsal, not the required deployed-system final video.')
(output/'SIMULATED_recording.json').write_text(json.dumps(meta,indent=2)+'\n')
assert 19.8<=meta['previewSeconds']<=20.2
print(json.dumps({'simulation':True,'previewSeconds':meta['previewSeconds'],'gif':str(gif),'mp4':str(mp4),'attackSpeedup':speed}))
