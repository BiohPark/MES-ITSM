# 이 저장소에서만 사용할 Git 사용자 이름/이메일 설정
# 실행: PowerShell에서 .\setup-git-user.ps1

$name = Read-Host "Git 사용자 이름 (예: Hong Gildong)"
$email = Read-Host "Git 이메일 (예: hong@example.com)"

if ($name -and $email) {
    git config user.name $name
    git config user.email $email
    Write-Host "설정 완료. 이제 이 폴더에서 commit이 가능합니다."
} else {
    Write-Host "이름과 이메일을 모두 입력해 주세요."
}
