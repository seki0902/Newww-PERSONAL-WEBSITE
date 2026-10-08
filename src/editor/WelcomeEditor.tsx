import type { ContentBundle } from "../content-bundle/schema";

const imageFields = [
  { key: "characterAssetId", label: "欢迎页人物" },
  { key: "dialogueAssetId", label: "对话框图片" },
  { key: "nameplateAssetId", label: "署名框图片" },
  { key: "backgroundAssetId", label: "欢迎页背景" },
  { key: "highlightedChoiceAssetId", label: "选项高亮图片" },
  { key: "cursorAssetId", label: "指针图片" },
] as const;

type WelcomeEditorProps = {
  content: ContentBundle["welcome"];
  assets: ContentBundle["assets"];
  bgmAssetId?: string;
  onChange: (content: ContentBundle["welcome"]) => void;
  onBgmChange: (assetId: string | undefined) => void;
  onEditDesktop: (desktopId: string) => void;
};

export function WelcomeEditor({ content, assets, bgmAssetId, onChange, onBgmChange, onEditDesktop }: WelcomeEditorProps) {
  const images = assets.filter((asset) => asset.type === "image");
  const audio = assets.filter((asset) => asset.type === "audio");
  const update = (patch: Partial<ContentBundle["welcome"]>) => onChange({ ...content, ...patch });
  const updateChoice = (index: number, patch: Partial<ContentBundle["welcome"]["choices"][number]>) => update({
    choices: content.choices.map((choice, current) => current === index ? { ...choice, ...patch } : choice),
  });

  return <section className="welcome-editor editor-standalone-section">
    <div className="editor-section-intro"><h3>引导后的欢迎选择页</h3><p>在两页新手引导之后显示，背景继续保持模糊；三个选项分别进入三个独立桌面。每个桌面的内容在「桌面系统」中单独编辑。</p></div>
    <label>欢迎页署名<input value={content.speakerName} onChange={(event) => update({ speakerName: event.target.value })} /></label>
    <label>欢迎页文案<textarea value={content.message} onChange={(event) => update({ message: event.target.value })} /><small>换行会保留在对话框中。</small></label>
    <div className="editor-two-columns">{imageFields.map((field) => <label key={field.key}>{field.label}
      <select value={content[field.key] ?? ""} onChange={(event) => update({ [field.key]: event.target.value || undefined })}>
        <option value="">默认可画素材</option>
        {images.map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}
      </select>
    </label>)}</div>
    {content.choices.map((choice, index) => <fieldset className="welcome-choice-fields" key={choice.id}>
      <legend>选项 {index + 1}</legend>
      <button type="button" onClick={() => onEditDesktop(choice.id)}>编辑此选项对应的桌面</button>
      <label>选项 {index + 1} 文字<input value={choice.label} onChange={(event) => updateChoice(index, { label: event.target.value })} /></label>
      <label>选项 {index + 1} 背景<select value={choice.assetId ?? ""} onChange={(event) => updateChoice(index, { assetId: event.target.value || undefined })}><option value="">默认可画按钮</option>{images.map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}</select></label>
    </fieldset>)}
    <div className="editor-two-columns">
      <label>欢迎页 BGM<select value={bgmAssetId ?? ""} onChange={(event) => onBgmChange(event.target.value || undefined)}><option value="">无</option>{audio.map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}</select><small>新手引导和欢迎页使用此音乐；三个桌面的音乐分别在「桌面系统」编辑。</small></label>
      <label>欢迎页点击音效<select value={content.clickSoundAssetId ?? ""} onChange={(event) => update({ clickSoundAssetId: event.target.value || undefined })}><option value="">无</option>{audio.map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}</select></label>
    </div>
  </section>;
}
