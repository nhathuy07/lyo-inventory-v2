
<script>
    let {row} = $props()
</script>

<img style="object-fit: cover; border-radius: 5px" src={row.image_path} alt={row.name} width="143px" height="143px" loading="lazy"/>