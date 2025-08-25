$(document).ready(function() {
    const observer = lozad();
    observer.observe();

    $(document).on('click', '.has-sub', function(){
        var _this = $(this);
        if(!$(this).hasClass('expanded')) {
            setTimeout(function(){ _this.find('ul').attr("style","") }, 300);
        } else {
            $('.has-sub ul').each(function(id,ele){
                var _that = $(this)
                if(_this.find('ul')[0] != ele) {
                    setTimeout(function(){ _that.attr("style","") }, 300);
                }
            })
        }
    });

    $('.user-info-menu .hidden-sm').click(function(){
        if($('.sidebar-menu').hasClass('collapsed')) {
            $('.has-sub.expanded > ul').attr("style","")
        } else {
            $('.has-sub.expanded > ul').show()
        }
    });

    $("#main-menu li ul li").click(function() {
        $(this).siblings('li').removeClass('active');
        $(this).addClass('active');
    });

    $("a.smooth").click(function(ev) {
        ev.preventDefault();
        public_vars.$mainMenu.add(public_vars.$sidebarProfile).toggleClass('mobile-is-visible');
        ps_destroy();
        $("html, body").animate({
            scrollTop: $($(this).attr("href")).offset().top - 30
        }, {duration: 500, easing: "swing"});
    });

    // -----------------------------
    // ADD RANDOM SVG ICONS
    // -----------------------------
    $.getJSON("../assets/json/svg-icons.json", function(svgList) {
    $(".random-icon").each(function() {
            var randomSvg = svgList[Math.floor(Math.random() * svgList.length)];
            $(this).html('<img src="../' + randomSvg + '" alt="icon" class="random-svg">');
        });
    });

    // open page
    $(document).on("click", ".xe-widget[data-page]", function() {
      const page = $(this).data("page");
      if (page) {
        const url = chrome.runtime.getURL(page);
        window.open(url, "_blank");
      }
    });

});


